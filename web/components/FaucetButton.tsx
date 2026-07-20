"use client";

import { useState } from "react";
import { useWallet } from "./WalletProvider";
import { Spinner } from "./ui";

// Requests test USDC from the server-side faucet (which holds the issuer key).
export function FaucetButton({ onDone }: { onDone?: () => void }) {
  const { address } = useWallet();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function request() {
    if (!address) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Faucet request failed.");
      setMsg("Sent 500 test USDC");
      onDone?.();
    } catch (e: any) {
      setMsg(e?.message ?? "Faucet failed.");
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(null), 4000);
    }
  }

  if (!address) return null;

  return (
    <div className="relative">
      <button
        onClick={request}
        disabled={loading}
        className="btn-ghost text-sm"
        title="Mint test USDC to your wallet"
      >
        {loading ? <Spinner /> : "Get test USDC"}
      </button>
      {msg && (
        <span className="absolute left-0 top-full mt-1 whitespace-nowrap text-xs text-slate-400">
          {msg}
        </span>
      )}
    </div>
  );
}
