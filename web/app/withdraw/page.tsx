"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import { Alert, Spinner } from "@/components/ui";
import { getTokenBalance } from "@/lib/contract";
import { formatAmount, fromBaseUnits } from "@/lib/format";
import { config } from "@/lib/config";

// Mocked USDC -> Naira off-ramp. A production build would hand off to a licensed
// anchor over SEP-24; here we simulate the anchor UX end-to-end so the payout
// story is complete for the demo. No real funds move.
const NGN_PER_USDC = 1560;

type Stage = "form" | "processing" | "done";

export default function WithdrawPage() {
  const { address, connect, connecting } = useWallet();
  const [balance, setBalance] = useState<bigint | null>(null);
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [stage, setStage] = useState<Stage>("form");
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState("");

  useEffect(() => {
    if (address) getTokenBalance(address).then(setBalance).catch(() => {});
  }, [address]);

  const naira = amount ? Number(amount) * NGN_PER_USDC : 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (balance !== null && n > Number(fromBaseUnits(balance))) {
      setError("Amount exceeds your available balance.");
      return;
    }
    if (accountNo.replace(/\D/g, "").length < 10) {
      setError("Enter a valid 10-digit account number.");
      return;
    }
    if (!bank) {
      setError("Select your bank.");
      return;
    }
    setStage("processing");
    // Simulate anchor settlement time.
    setTimeout(() => {
      setRef(`PL-${Date.now().toString(36).toUpperCase()}`);
      setStage("done");
    }, 2200);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Withdraw to Naira</h1>
        <p className="mt-1 text-sm text-slate-400">
          Convert your {config.tokenSymbol} to NGN and send it to your bank
          account.
        </p>
      </div>

      <Alert kind="info">
        Demo anchor: this simulates a licensed off-ramp (SEP-24). No real bank
        transfer occurs and no on-chain funds move.
      </Alert>

      {!address ? (
        <div className="card flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-slate-300">Connect your wallet to withdraw.</p>
          <button onClick={connect} disabled={connecting} className="btn-primary">
            {connecting ? "Connecting…" : "Connect wallet"}
          </button>
        </div>
      ) : stage === "done" ? (
        <div className="card space-y-4 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-3xl">
            ✓
          </div>
          <div>
            <p className="text-xl font-bold">Withdrawal initiated</p>
            <p className="mt-1 text-sm text-slate-400">
              ₦{naira.toLocaleString()} is on its way to your{" "}
              {bank} account ending {accountNo.slice(-4)}.
            </p>
          </div>
          <div className="rounded-lg bg-ink-900/60 p-3 text-sm">
            <span className="text-slate-500">Reference</span>{" "}
            <span className="font-mono">{ref}</span>
          </div>
          <button
            className="btn-ghost w-full"
            onClick={() => {
              setStage("form");
              setAmount("");
              setAccountNo("");
              setBank("");
            }}
          >
            Make another withdrawal
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="card space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Available</span>
            <span className="font-semibold">
              {balance === null ? "—" : formatAmount(balance)}{" "}
              {config.tokenSymbol}
            </span>
          </div>

          <div>
            <label className="label" htmlFor="amt">
              Amount ({config.tokenSymbol})
            </label>
            <input
              id="amt"
              className="input"
              inputMode="decimal"
              placeholder="100.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={stage === "processing"}
            />
            {naira > 0 && (
              <p className="mt-1.5 text-sm text-slate-400">
                You&apos;ll receive ≈{" "}
                <span className="font-semibold text-slate-200">
                  ₦{naira.toLocaleString()}
                </span>{" "}
                <span className="text-slate-500">
                  (₦{NGN_PER_USDC.toLocaleString()}/{config.tokenSymbol})
                </span>
              </p>
            )}
          </div>

          <div>
            <label className="label" htmlFor="bank">
              Bank
            </label>
            <select
              id="bank"
              className="input"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              disabled={stage === "processing"}
            >
              <option value="">Select bank…</option>
              <option>Access Bank</option>
              <option>GTBank</option>
              <option>Kuda</option>
              <option>Opay</option>
              <option>UBA</option>
              <option>Zenith Bank</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="acct">
              Account number
            </label>
            <input
              id="acct"
              className="input"
              inputMode="numeric"
              placeholder="0123456789"
              value={accountNo}
              onChange={(e) => setAccountNo(e.target.value)}
              maxLength={10}
              disabled={stage === "processing"}
            />
          </div>

          {error && <Alert kind="error">{error}</Alert>}

          <button
            type="submit"
            disabled={stage === "processing"}
            className="btn-primary w-full"
          >
            {stage === "processing" ? (
              <>
                <Spinner /> Contacting anchor…
              </>
            ) : (
              "Withdraw to bank"
            )}
          </button>
        </form>
      )}
    </div>
  );
}
