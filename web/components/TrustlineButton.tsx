"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "./WalletProvider";
import { Alert, Spinner } from "./ui";
import { establishTokenTrustline, hasTokenTrustline } from "@/lib/contract";
import { config } from "@/lib/config";
import { useTokenMeta } from "@/lib/use-token-meta";
import { trackEvent } from "@/lib/analytics";
import { errorMessage } from "@/lib/async-resource";

// Detects whether the connected wallet trusts the USDC asset and, if not,
// offers a one-click button to establish the trustline via the active wallet. This
// removes the biggest onboarding footgun: without a trustline the faucet mint
// and invoice payment both fail with a cryptic "trustline missing" error.
export function TrustlineButton({
  onDone,
  tokenId = config.tokenId,
}: {
  onDone?: () => void;
  tokenId?: string;
}) {
  const { address } = useWallet();
  const token = useTokenMeta(tokenId);
  const [trusted, setTrusted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    if (!address) return;
    try {
      setTrusted(await hasTokenTrustline(address, tokenId));
    } catch {
      setTrusted(null);
    }
  }, [address, tokenId]);

  useEffect(() => {
    setTrusted(null);
    check();
  }, [check]);

  async function enable() {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      await establishTokenTrustline(address, tokenId);
      setTrusted(true);
      trackEvent("trustline_enabled");
      onDone?.();
    } catch (e) {
      setError(errorMessage(e, `Could not enable ${token.symbol}.`));
    } finally {
      setLoading(false);
    }
  }

  // Nothing to show if disconnected, still checking, or already trusted.
  if (!address || trusted === null || trusted) return null;

  return (
    <div className="space-y-2">
      <Alert kind="info">
        This wallet needs to enable {token.symbol} before it can receive or pay.
        This is a one-time, no-cost step.
      </Alert>
      {error && <Alert kind="error">{error}</Alert>}
      <button
        onClick={enable}
        disabled={loading}
        className="btn-primary w-full"
      >
        {loading ? (
          <>
            <Spinner /> Enabling {token.symbol}…
          </>
        ) : (
          `Enable ${token.symbol}`
        )}
      </button>
    </div>
  );
}
