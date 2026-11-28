"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Alert, Spinner, StatusBadge, EmptyState } from "@/components/ui";
import { ScanStatus } from "@/components/ScanStatus";
import { AddressChip } from "@/components/AddressChip";
import type { Invoice } from "@/lib/contract";
import { SettledVolumeChart } from "@/components/charts/SettledVolumeChart";
import { StatusSplitBar } from "@/components/charts/StatusSplitBar";
import { useInvoiceScan } from "@/lib/use-invoice-scan";
import {
  formatAmount,
  formatDate,
  humanizeDescription,
} from "@/lib/format";
import { config, explorer, getTokenConfig, isConfigured } from "@/lib/config";
import { TokenAmount } from "@/components/TokenAmount";
import { bucketSettledVolume } from "@/lib/stats";
import { toCsv } from "@/lib/csv";

const PAGE_SIZE = 10;

type ActivityStatusFilter = "all" | Invoice["status"];
type SortKey =
  | "id"
  | "description"
  | "freelancer"
  | "client"
  | "amount"
  | "status"
  | "created";
type SortDirection = "asc" | "desc";

// Public activity feed: reads every invoice straight off the contract and
// surfaces aggregate usage. Doubles as verifiable proof of wallet interactions
// for the submission — every freelancer/client address links to the explorer.
export default function ActivityPage() {
  const scan = useInvoiceScan();
  const invoices = useMemo(
    () => [...scan.invoices].reverse(), // newest first
    [scan.invoices]
  );
  const { loading, error, reachedCap, scannedThrough } = scan;
  const load = scan.retry;
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ActivityStatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);

  function downloadCsv() {
    // Export the loaded on-chain invoices as CSV, reusable proof of usage
    // activity for analytics / reporting without a backend.
    const header = [
      "invoice_id",
      "description",
      "amount",
      "token_id",
      "status",
      "freelancer_address",
      "client_address",
      "created_at_utc",
      "paid_at_utc",
    ];
    const rows = [...invoices]
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map((i) => [
        i.id,
        humanizeDescription(i.description),
        formatAmount(i.amount, getTokenConfig(i.token).decimals),
        i.token,
        i.status,
        i.freelancer,
        i.client,
        i.createdAt > 0n
          ? new Date(Number(i.createdAt) * 1000).toISOString()
          : "",
        i.paidAt > 0n ? new Date(Number(i.paidAt) * 1000).toISOString() : "",
      ]);
    const blob = new Blob([toCsv([header, ...rows])], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payloop-activity-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!isConfigured()) {
    return (
      <Alert kind="info">The contract isn&apos;t configured yet.</Alert>
    );
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filteredInvoices = invoices.filter(
    (invoice) =>
      (statusFilter === "all" || invoice.status === statusFilter) &&
      invoiceMatchesQuery(invoice, normalizedQuery)
  );
  const sortedInvoices = [...filteredInvoices].sort((a, b) =>
    compareActivityInvoices(a, b, sortKey, sortDirection)
  );
  const pageCount = Math.max(
    1,
    Math.ceil(sortedInvoices.length / PAGE_SIZE)
  );
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, sortedInvoices.length);
  const pagedInvoices = sortedInvoices.slice(pageStart, pageEnd);
  const rangeStart = sortedInvoices.length === 0 ? 0 : pageStart + 1;
  const rangeEnd = pageEnd;

  function handleSort(key: SortKey) {
    const nextDirection =
      sortKey === key
        ? sortDirection === "asc"
          ? "desc"
          : "asc"
        : defaultSortDirection(key);
    setSortKey(key);
    setSortDirection(nextDirection);
    setPage(1);
  }

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
    setPage(1);
  }

  const paid = invoices.filter((i) => i.status === "Paid");
  const pending = invoices.filter((i) => i.status !== "Paid");
  const uniqueWallets = new Set<string>();
  invoices.forEach((i) => {
    uniqueWallets.add(i.freelancer);
    uniqueWallets.add(i.client);
  });
  const paidByToken = new Map<string, bigint>();
  paid.forEach((i) =>
    paidByToken.set(i.token, (paidByToken.get(i.token) ?? 0n) + i.amount)
  );
  const { granularity, buckets } = bucketSettledVolume(paid);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">On-chain activity</h1>
          <p className="mt-1 text-sm text-slate-400">
            A live view of invoices recorded on the PayLoop contract, newest
            first.{" "}
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
        <div className="flex gap-2">
          <button
            onClick={downloadCsv}
            disabled={invoices.length === 0}
            className="btn-ghost text-xs"
            title="Download all invoices as CSV"
          >
            ⬇ Export CSV
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="btn-ghost text-xs"
          >
            {loading ? <Spinner /> : "Refresh"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Invoices" value={String(invoices.length)} />
        <Stat label="Paid" value={String(paid.length)} tone="emerald" />
        <Stat
          label="Wallets involved"
          value={String(uniqueWallets.size)}
          tone="brand"
        />
        <div className="card">
          <p className="text-xs text-slate-400">Settled</p>
          {paidByToken.size === 0 ? (
            <p className="mt-1 text-2xl font-bold">0</p>
          ) : (
            [...paidByToken].map(([tokenId, amount]) => (
              <p key={tokenId} className="mt-1 text-2xl font-bold">
                <TokenAmount amount={amount} tokenId={tokenId} />
              </p>
            ))
          )}
        </div>
      </div>

      {invoices.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatusSplitBar paid={paid.length} pending={pending.length} />
          <SettledVolumeChart granularity={granularity} buckets={buckets} />
        </div>
      )}

      <ScanStatus
        error={error}
        reachedCap={reachedCap}
        count={invoices.length}
        scannedThrough={scannedThrough}
        loading={loading}
        onRetry={load}
      />

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
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="flex-1">
              <label htmlFor="activity-search" className="label">
                Search invoices
              </label>
              <input
                id="activity-search"
                type="search"
                className="input"
                placeholder="Search id, description, address, amount…"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div>
              <label htmlFor="activity-status-filter" className="label">
                Status
              </label>
              <select
                id="activity-status-filter"
                className="input w-auto"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as ActivityStatusFilter);
                  setPage(1);
                }}
              >
                <option value="all">All statuses</option>
                <option value="Pending">Pending</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
            <p className="text-xs text-slate-400 lg:pb-2.5">
              {filteredInvoices.length === 0
                ? "No matching invoices"
                : `Showing ${rangeStart}–${rangeEnd} of ${filteredInvoices.length}`}
            </p>
          </div>

          {filteredInvoices.length === 0 ? (
            <EmptyState
              title="No matching invoices"
              subtitle="Try a different search or clear the status filter."
              action={
                <button
                  type="button"
                  onClick={clearFilters}
                  className="btn-ghost text-sm"
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            <>
              <div className="overflow-hidden rounded-2xl border border-white/10">
                {/* Table on sm+, stacked cards on mobile */}
                <table className="hidden w-full text-sm sm:table">
                  <caption className="sr-only">
                    PayLoop invoice activity
                  </caption>
                  <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <SortHeader
                        label="#"
                        column="id"
                        sortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortHeader
                        label="Description"
                        column="description"
                        sortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortHeader
                        label="Freelancer"
                        column="freelancer"
                        sortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortHeader
                        label="Client"
                        column="client"
                        sortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortHeader
                        label="Amount"
                        column="amount"
                        align="right"
                        sortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortHeader
                        label="Status"
                        column="status"
                        sortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortHeader
                        label="Created"
                        column="created"
                        sortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {pagedInvoices.map((inv) => (
                      <tr
                        key={inv.id}
                        className="border-t border-white/5 hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-3 font-mono text-slate-400">
                          {inv.id}
                        </td>
                        <td className="max-w-[16rem] truncate px-4 py-3">
                          {humanizeDescription(inv.description) || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <WalletLink addr={inv.freelancer} />
                        </td>
                        <td className="px-4 py-3">
                          <WalletLink addr={inv.client} />
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          <TokenAmount amount={inv.amount} tokenId={inv.token} />
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
                  {pagedInvoices.map((inv) => (
                    <div key={inv.id} className="space-y-2 bg-ink-800/40 p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-slate-400">
                          #{inv.id}
                        </span>
                        <StatusBadge status={inv.status} />
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="truncate text-sm">
                          {humanizeDescription(inv.description) || "—"}
                        </span>
                        <span className="ml-2 shrink-0 font-semibold">
                          <TokenAmount amount={inv.amount} tokenId={inv.token} />
                        </span>
                      </div>
                      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span>
                          From <WalletLink addr={inv.freelancer} />
                        </span>
                        <span>
                          To <WalletLink addr={inv.client} />
                        </span>
                        <span className="w-full text-slate-500">
                          {formatDate(inv.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <nav
                aria-label="Invoice pagination"
                className="flex items-center justify-between gap-3"
              >
                <button
                  type="button"
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage <= 1}
                  className="btn-ghost text-xs"
                >
                  Previous
                </button>
                <span className="text-xs text-slate-400" aria-live="polite">
                  Page {safePage} of {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage >= pageCount}
                  className="btn-ghost text-xs"
                >
                  Next
                </button>
              </nav>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function invoiceMatchesQuery(invoice: Invoice, query: string): boolean {
  if (!query) return true;
  const token = getTokenConfig(invoice.token);
  const amount = formatAmount(invoice.amount, token.decimals);
  const haystack = [
    invoice.id,
    humanizeDescription(invoice.description),
    invoice.freelancer,
    invoice.client,
    invoice.status,
    invoice.token,
    token.symbol,
    amount,
    amount.replaceAll(",", ""),
    formatDate(invoice.createdAt),
  ]
    .join("\n")
    .toLowerCase();
  return haystack.includes(query);
}

function compareBigInt(a: bigint, b: bigint): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

function compareInvoiceIds(a: Invoice, b: Invoice): number {
  if (/^\d+$/.test(a.id) && /^\d+$/.test(b.id)) {
    return compareBigInt(BigInt(a.id), BigInt(b.id));
  }
  return a.id.localeCompare(b.id);
}

function defaultSortDirection(key: SortKey): SortDirection {
  return key === "created" || key === "amount" || key === "id"
    ? "desc"
    : "asc";
}

function compareActivityInvoices(
  a: Invoice,
  b: Invoice,
  key: SortKey,
  direction: SortDirection
): number {
  let result = 0;
  switch (key) {
    case "id":
      result = compareInvoiceIds(a, b);
      break;
    case "description":
      result = humanizeDescription(a.description).localeCompare(
        humanizeDescription(b.description)
      );
      break;
    case "freelancer":
      result = a.freelancer.localeCompare(b.freelancer);
      break;
    case "client":
      result = a.client.localeCompare(b.client);
      break;
    case "amount":
      result = compareBigInt(a.amount, b.amount);
      break;
    case "status":
      result = a.status.localeCompare(b.status);
      break;
    case "created":
      result = compareBigInt(a.createdAt, b.createdAt);
      break;
  }
  if (result !== 0) return direction === "asc" ? result : -result;

  result = compareBigInt(b.createdAt, a.createdAt);
  if (result !== 0) return result;
  return compareInvoiceIds(b, a);
}

function SortHeader({
  label,
  column,
  align,
  sortKey,
  sortDirection,
  onSort,
}: {
  label: string;
  column: SortKey;
  align?: "right";
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === column;
  const ariaSort: "ascending" | "descending" | "none" = active
    ? sortDirection === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`px-4 py-3 ${align === "right" ? "text-right" : ""}`}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1"
      >
        {label}
        <span aria-hidden="true" className="text-[10px]">
          {active ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
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
  return <AddressChip address={addr} className="text-brand-300" />;
}
