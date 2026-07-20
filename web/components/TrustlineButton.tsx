"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "./WalletProvider";
import { Alert, Spinner } from "./ui";
import { establishUsdcTrustline, hasUsdcTrustline } from "@/lib/contract";
import { config } from "@/lib/config";

// Detects whether the connected wallet trusts the USDC asset and, if not,
// offers a one-click button to establish the trustline via Freighter. This
// removes the biggest onboarding footgun: without a trustline the faucet mint
// and invoice payment both fail with a cryptic "trustline missing" error.
export function TrustlineButton({ onDone }: { onDone?: () => void }) {
  const { address } = useWallet();
  const [trusted, setTrusted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    if (!address) return;
    try {
      setTrusted(await hasUsdcTrustline(address));
    } catch {
      setTrusted(null);
    }
  }, [address]);

  useEffect(() => {
    setTrusted(null);
    check();
  }, [check]);

  async function enable() {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      await establishUsdcTrustline(address);
      setTrusted(true);
      onDone?.();
    } catch (e: any) {
      setError(e?.message ?? "Could not enable USDC.");
    } finally {
      setLoading(false);
    }
  }

  // Nothing to show if disconnected, still checking, or already trusted.
  if (!address || trusted === null || trusted) return null;

  return (
    <div className="space-y-2">
      <Alert kind="info">
        This wallet needs to enable {config.tokenSymbol} before it can receive
        or pay. This is a one-time, no-cost step.
      </Alert>
      {error && <Alert kind="error">{error}</Alert>}
      <button
        onClick={enable}
        disabled={loading}
        className="btn-primary w-full"
      >
        {loading ? (
          <>
            <Spinner /> Enabling {config.tokenSymbol}…
          </>
        ) : (
          `Enable ${config.tokenSymbol}`
        )}
      </button>
    </div>
  );
}
