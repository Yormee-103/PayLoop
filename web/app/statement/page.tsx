"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/components/WalletProvider";
import { Alert, EmptyState, Spinner, StatusBadge } from "@/components/ui";
import { getAllInvoices, type Invoice } from "@/lib/contract";
import { formatAmount, formatDate, humanizeDescription, shortAddress } from "@/lib/format";
import { config, isConfigured } from "@/lib/config";
import { calculateStatementSummary, filterStatementInvoices } from "@/lib/stats";

export default function StatementPage() {
  const { address, connect, connecting } = useWallet();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await getAllInvoices();
      setInvoices(all);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load invoices for statement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!address) return [];
    return filterStatementInvoices(invoices, address, startDate, endDate);
  }, [invoices, address, startDate, endDate]);

  const summary = useMemo(() => {
    return calculateStatementSummary(filtered);
  }, [filtered]);

  function setPreset(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  }

  function setYtd() {
    const end = new Date();
    const start = new Date(end.getFullYear(), 0, 1);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  }

  function clearRange() {
    setStartDate("");
    setEndDate("");
  }

  if (!isConfigured()) {
    return <Alert kind="info">The contract isn&apos;t configured yet.</Alert>;
  }

  if (!address) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Proof of Income</h1>
          <p className="mt-1 text-sm text-slate-400">
            Generate an official, printable on-chain statement of earned freelance income.
          </p>
        </div>
        <div className="card flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-slate-300">
            Connect your wallet to generate a statement from your paid invoices.
          </p>
          <button onClick={connect} disabled={connecting} className="btn-primary">
            {connecting ? "Connecting…" : "Connect wallet"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top screen header (hidden on print) */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Income Statement</h1>
          <p className="mt-1 text-sm text-slate-400">
            Verified proof of earnings for banks, landlords, or visa applications.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/history" className="btn-ghost text-xs">
            ← Back to History
          </Link>
          <button
            onClick={() => window.print()}
            disabled={filtered.length === 0}
            className="btn-primary text-xs flex items-center gap-1.5"
            title="Print or Save as PDF"
          >
            <span>🖨️</span> Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Date Range controls (hidden on print) */}
      <div className="card space-y-3 print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="startDate" className="block text-xs font-medium text-slate-400 mb-1">
              From Date
            </label>
            <input
              id="startDate"
              type="date"
              className="input text-xs py-1.5"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-xs font-medium text-slate-400 mb-1">
              To Date
            </label>
            <input
              id="endDate"
              type="date"
              className="input text-xs py-1.5"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1.5 pb-0.5">
            <button
              type="button"
              onClick={() => setPreset(30)}
              className="btn-ghost text-xs py-1.5 px-2.5"
            >
              Last 30 days
            </button>
            <button
              type="button"
              onClick={() => setPreset(90)}
              className="btn-ghost text-xs py-1.5 px-2.5"
            >
              Last 90 days
            </button>
            <button
              type="button"
              onClick={setYtd}
              className="btn-ghost text-xs py-1.5 px-2.5"
            >
              Year to Date
            </button>
            <button
              type="button"
              onClick={clearRange}
              className="btn-ghost text-xs py-1.5 px-2.5"
            >
              All Time
            </button>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="btn-ghost ml-auto text-xs py-1.5"
          >
            {loading ? <Spinner /> : "Refresh"}
          </button>
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

      {/* Printable Statement Document (Isolated via .print-area) */}
      <div className="print-area">
        <div className="card invoice-print space-y-6">
          {/* Header */}
          <div className="border-b border-white/10 pb-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500 text-lg font-bold text-white">
                  ₽
                </span>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">PayLoop Income Statement</h2>
                  <p className="text-xs text-slate-400">
                    Official On-Chain Proof of Earned Freelance Income
                  </p>
                </div>
              </div>
              <div className="text-right text-xs text-slate-400">
                <p>
                  Generated:{" "}
                  <span className="font-medium text-slate-200">
                    {new Date().toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </p>
                <p className="mt-0.5">Network: Stellar {config.network}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg bg-ink-900/60 p-3 text-xs">
              <div>
                <span className="text-slate-500 uppercase tracking-wider block text-[10px]">
                  Recipient (Freelancer)
                </span>
                <span className="font-mono text-slate-200 break-all">{address}</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase tracking-wider block text-[10px]">
                  Statement Coverage Period
                </span>
                <span className="text-slate-200 font-medium">
                  {startDate || endDate
                    ? `${startDate || "Beginning"} to ${endDate || "Present"}`
                    : "Complete History (All Time)"}
                </span>
              </div>
            </div>
          </div>

          {/* Aggregate Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-white/5 p-3.5 border border-white/5">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Total Earned
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-400">
                {formatAmount(summary.totalIncome)}{" "}
                <span className="text-xs font-normal text-slate-400">
                  {config.tokenSymbol}
                </span>
              </p>
            </div>
            <div className="rounded-lg bg-white/5 p-3.5 border border-white/5">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Invoices Settled
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-200">
                {summary.totalPaidCount}
              </p>
            </div>
            <div className="rounded-lg bg-white/5 p-3.5 border border-white/5">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Distinct Clients
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-200">
                {summary.uniqueClientsCount}
              </p>
            </div>
            <div className="rounded-lg bg-white/5 p-3.5 border border-white/5">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Active Period
              </p>
              <p className="mt-1 text-sm font-medium text-slate-300">
                {summary.earliestPaidAt ? formatDate(summary.earliestPaidAt) : "—"}
                {" – "}
                {summary.latestPaidAt ? formatDate(summary.latestPaidAt) : "—"}
              </p>
            </div>
          </div>

          {/* Breakdown Table */}
          {loading && filtered.length === 0 ? (
            <div className="space-y-2 py-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-white/5" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No paid invoices in this period"
              subtitle="Try adjusting your start and end dates or selecting All Time."
              action={
                <button onClick={clearRange} className="btn-ghost text-xs print:hidden">
                  Clear Date Filters
                </button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 font-medium">
                    <th className="py-2.5 pr-2">ID</th>
                    <th className="py-2.5 px-2">Date Settled</th>
                    <th className="py-2.5 px-2">Client</th>
                    <th className="py-2.5 px-2">Description</th>
                    <th className="py-2.5 px-2 text-right">Amount</th>
                    <th className="py-2.5 pl-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.map((inv) => (
                    <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-2.5 pr-2 font-mono text-slate-400">
                        <Link
                          href={`/pay/${inv.id}`}
                          className="hover:underline text-brand-400 print:text-inherit"
                        >
                          #{inv.id}
                        </Link>
                      </td>
                      <td className="py-2.5 px-2 whitespace-nowrap text-slate-300">
                        {formatDate(inv.paidAt > 0n ? inv.paidAt : inv.createdAt)}
                      </td>
                      <td className="py-2.5 px-2 font-mono text-slate-300">
                        <span title={inv.client}>{shortAddress(inv.client)}</span>
                      </td>
                      <td className="py-2.5 px-2 text-slate-200 max-w-xs truncate">
                        {humanizeDescription(inv.description) || "—"}
                      </td>
                      <td className="py-2.5 px-2 text-right font-semibold text-slate-100 whitespace-nowrap">
                        {formatAmount(inv.amount)} {config.tokenSymbol}
                      </td>
                      <td className="py-2.5 pl-2 text-center whitespace-nowrap">
                        <StatusBadge status={inv.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-white/20 font-semibold text-slate-100">
                    <td colSpan={4} className="py-3 px-2 text-right uppercase tracking-wider text-[11px]">
                      Total Income Earned:
                    </td>
                    <td className="py-3 px-2 text-right text-emerald-400 text-sm whitespace-nowrap">
                      {formatAmount(summary.totalIncome)} {config.tokenSymbol}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Statement Verification Footer */}
          <div className="border-t border-white/10 pt-4 text-[11px] text-slate-400 space-y-1">
            <p className="font-medium text-slate-300">
              On-Chain Verification Statement
            </p>
            <p>
              Each invoice recorded above is cryptographically settled and confirmed on the Stellar
              network via Soroban contract{" "}
              <span className="font-mono text-slate-300 break-all">{config.contractId}</span>.
            </p>
            <p className="text-[10px] text-slate-500">
              Generated by PayLoop · Portable Freelancer Income Record · Immutable Ledger Proof
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
