"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/components/WalletProvider";
import { InvoiceCard } from "@/components/InvoiceCard";
import { Alert, EmptyState, Spinner } from "@/components/ui";
import { getInvoiceHistory, getTokenBalance, type Invoice } from "@/lib/contract";
import { formatAmount, humanizeDescription } from "@/lib/format";
import { config, isConfigured } from "@/lib/config";
import { FaucetButton } from "@/components/FaucetButton";
import { TrustlineButton } from "@/components/TrustlineButton";

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
  const pending = invoices.filter((i) => i.status === "Pending");
  const nowMs = Date.now();
  const overdue = pending.filter(
    (i) => i.dueDate > 0n && i.dueDate * 1000n < BigInt(nowMs)
  );

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

      {error && (
        <Alert kind="error">
          <span>{error}</span>{" "}
          <button onClick={load} className="ml-2 underline">
            Retry
          </button>
        </Alert>
      )}

      <TrustlineButton onDone={load} />

      {pending.length > 0 && (
        <RemindersCard pending={pending} overdueCount={overdue.length} />
      )}

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
          subtitle="Three quick steps to your first payment: enable USDC, create an invoice, share the link."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/create" className="btn-primary text-sm">
                Create invoice
              </Link>
              <Link href="/history" className="btn-ghost text-sm">
                History
              </Link>
            </div>
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

// Quick-action card for unpaid invoices: one click copies a reminder message
// per pending invoice (Level-4 feedback: "payment reminders").
function RemindersCard({
  pending,
  overdueCount,
}: {
  pending: Invoice[];
  overdueCount: number;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function remind(inv: Invoice) {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/pay/${inv.id}`
        : `/pay/${inv.id}`;
    const text = `Hi! You have an outstanding PayLoop invoice #${inv.id} for ${formatAmount(
      inv.amount
    )} ${config.tokenSymbol} (${humanizeDescription(inv.description) || "no description"}). Please pay it here: ${url}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(inv.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.location.href = url;
    }
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">Payment reminders</p>
          <p className="text-xs text-slate-400">
            {pending.length} pending ·{" "}
            {overdueCount > 0 ? (
              <span className="text-red-300">{overdueCount} overdue</span>
            ) : (
              "none overdue"
            )}
          </p>
        </div>
        <span className="text-xl">🔔</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {pending.map((inv) => (
          <button
            key={inv.id}
            onClick={() => remind(inv)}
            className="btn-ghost text-xs"
            title="Copy a reminder message to send to your client"
          >
            {copiedId === inv.id ? "Copied ✓" : `Remind #${inv.id}`}
          </button>
        ))}
      </div>
    </div>
  );
}
