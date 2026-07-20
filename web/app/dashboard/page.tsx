"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/components/WalletProvider";
import { InvoiceCard } from "@/components/InvoiceCard";
import { Alert, EmptyState, Spinner } from "@/components/ui";
import { getInvoiceHistory, getTokenBalance, type Invoice } from "@/lib/contract";
import { formatAmount } from "@/lib/format";
import { config, isConfigured } from "@/lib/config";
import { FaucetButton } from "@/components/FaucetButton";

export default function DashboardPage() {
  const { address, connect, connecting } = useWallet();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const [hist, bal] = await Promise.all([
        getInvoiceHistory(address),
        getTokenBalance(address),
      ]);
      // Newest first.
      setInvoices([...hist].reverse());
      setBalance(bal);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load your invoices.");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isConfigured()) {
    return (
      <Alert kind="info">
        The contract isn&apos;t configured yet. Set the{" "}
        <code>NEXT_PUBLIC_*</code> contract variables to use the dashboard.
      </Alert>
    );
  }

  if (!address) {
    return (
      <div className="card flex flex-col items-center gap-4 py-14 text-center">
        <h1 className="text-xl font-bold">Your dashboard</h1>
        <p className="text-slate-400">
          Connect your wallet to see your invoices and balance.
        </p>
        <button onClick={connect} disabled={connecting} className="btn-primary">
          {connecting ? "Connecting…" : "Connect wallet"}
        </button>
      </div>
    );
  }

  const paidTotal = invoices
    .filter((i) => i.status === "Paid")
    .reduce((acc, i) => acc + i.amount, 0n);
  const pendingTotal = invoices
    .filter((i) => i.status === "Pending")
    .reduce((acc, i) => acc + i.amount, 0n);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <FaucetButton onDone={load} />
          <Link href="/create" className="btn-primary text-sm">
            New invoice
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-slate-400">Wallet balance</p>
          <p className="mt-1 text-2xl font-bold">
            {balance === null ? "—" : formatAmount(balance)}{" "}
            <span className="text-base text-slate-400">
              {config.tokenSymbol}
            </span>
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-400">Received (paid)</p>
          <p className="mt-1 text-2xl font-bold text-emerald-300">
            {formatAmount(paidTotal)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-400">Awaiting payment</p>
          <p className="mt-1 text-2xl font-bold text-amber-300">
            {formatAmount(pendingTotal)}
          </p>
        </div>
      </div>

      {error && <Alert kind="error">{error}</Alert>}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your invoices</h2>
        <button
          onClick={load}
          disabled={loading}
          className="btn-ghost text-xs"
        >
          {loading ? <Spinner /> : "Refresh"}
        </button>
      </div>

      {loading && invoices.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="card h-40 animate-pulse bg-white/5" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          subtitle="Create your first invoice and share the payment link with a client."
          action={
            <Link href="/create" className="btn-primary text-sm">
              Create invoice
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {invoices.map((inv) => (
            <InvoiceCard key={inv.id} invoice={inv} role="freelancer" />
          ))}
        </div>
      )}
    </div>
  );
}
