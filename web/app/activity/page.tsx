"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Spinner, StatusBadge, EmptyState } from "@/components/ui";
import { getAllInvoices, type Invoice } from "@/lib/contract";
import { formatAmount, formatDate, shortAddress } from "@/lib/format";
import { config, explorer, isConfigured } from "@/lib/config";

// Public activity feed: reads every invoice straight off the contract and
// surfaces aggregate usage. Doubles as verifiable proof of wallet interactions
// for the submission — every freelancer/client address links to the explorer.
export default function ActivityPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await getAllInvoices();
      setInvoices([...all].reverse()); // newest first
    } catch (e: any) {
      setError(e?.message ?? "Failed to load on-chain activity.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!isConfigured()) {
    return (
      <Alert kind="info">The contract isn&apos;t configured yet.</Alert>
    );
  }

  const paid = invoices.filter((i) => i.status === "Paid");
  const uniqueWallets = new Set<string>();
  invoices.forEach((i) => {
    uniqueWallets.add(i.freelancer);
    uniqueWallets.add(i.client);
  });
  const totalPaid = paid.reduce((acc, i) => acc + i.amount, 0n);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">On-chain activity</h1>
          <p className="mt-1 text-sm text-slate-400">
            Every invoice recorded on the PayLoop contract, live from Stellar
            testnet.{" "}
            <a
              href={explorer.contract(config.contractId)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-300 underline-offset-2 hover:underline"
            >
              View contract ↗
            </a>
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="btn-ghost text-xs"
        >
          {loading ? <Spinner /> : "Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Invoices" value={String(invoices.length)} />
        <Stat label="Paid" value={String(paid.length)} tone="emerald" />
        <Stat
          label="Wallets involved"
          value={String(uniqueWallets.size)}
          tone="brand"
        />
        <Stat
          label={`Settled (${config.tokenSymbol})`}
          value={formatAmount(totalPaid)}
        />
      </div>

      {error && <Alert kind="error">{error}</Alert>}

      {loading && invoices.length === 0 ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-20 animate-pulse bg-white/5" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState
          title="No activity yet"
          subtitle="Once invoices are created and paid, they'll show up here."
          action={
            <Link href="/create" className="btn-primary text-sm">
              Create the first invoice
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          {/* Table on sm+, stacked cards on mobile */}
          <table className="hidden w-full text-sm sm:table">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Freelancer</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-t border-white/5 hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 font-mono text-slate-400">
                    {inv.id}
                  </td>
                  <td className="max-w-[16rem] truncate px-4 py-3">
                    {inv.description || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <WalletLink addr={inv.freelancer} />
                  </td>
                  <td className="px-4 py-3">
                    <WalletLink addr={inv.client} />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatAmount(inv.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {formatDate(inv.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="divide-y divide-white/5 sm:hidden">
            {invoices.map((inv) => (
              <div key={inv.id} className="space-y-2 bg-ink-800/40 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-slate-400">
                    #{inv.id}
                  </span>
                  <StatusBadge status={inv.status} />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="truncate text-sm">
                    {inv.description || "—"}
                  </span>
                  <span className="ml-2 shrink-0 font-semibold">
                    {formatAmount(inv.amount)} {config.tokenSymbol}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>
                    From <WalletLink addr={inv.freelancer} />
                  </span>
                  <span>
                    To <WalletLink addr={inv.client} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "brand";
}) {
  const color =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "brand"
        ? "text-brand-300"
        : "text-slate-100";
  return (
    <div className="card">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function WalletLink({ addr }: { addr: string }) {
  return (
    <a
      href={explorer.account(addr)}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-brand-300 underline-offset-2 hover:underline"
    >
      {shortAddress(addr)}
    </a>
  );
}
