"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/components/WalletProvider";
import { ConnectPrompt } from "@/components/ConnectPrompt";
import {
  Alert,
  EmptyState,
  OverdueBadge,
  Spinner,
  StatusBadge,
} from "@/components/ui";
import { AddressChip } from "@/components/AddressChip";
import { isOverdue } from "@/lib/invoice-helpers";
import { ScanStatus } from "@/components/ScanStatus";
import { InvoicePreview } from "@/components/InvoiceDocument";
import { ShareMenu } from "@/components/ShareMenu";
import type { Invoice } from "@/lib/contract";
import { useInvoiceScan } from "@/lib/use-invoice-scan";
import { formatAmount, formatDate, humanizeDescription } from "@/lib/format";
import { getTokenConfig, isConfigured } from "@/lib/config";
import { TokenAmount } from "@/components/TokenAmount";

type StatusFilter = "all" | "Pending" | "Paid";
type RoleFilter = "all" | "freelancer" | "client";

// Personal invoice history with search + status/role filtering. Addresses the
// top Level-4 feedback requests ("invoice history", "search and filtering").
export default function HistoryPage() {
  const { address } = useWallet();
  const {
    invoices,
    error,
    reachedCap,
    scannedThrough,
    loading,
    retry: load,
  } = useInvoiceScan();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [role, setRole] = useState<RoleFilter>("all");
  const [preview, setPreview] = useState<Invoice | null>(null);

  const mine = useMemo(() => {
    if (!address) return [];
    return invoices.filter(
      (i) => i.freelancer === address || i.client === address,
    );
  }, [invoices, address]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mine
      .filter((i) => {
        if (status === "Pending" && i.status !== "Pending") return false;
        if (status === "Paid" && i.status !== "Paid") return false;
        if (role === "freelancer" && i.freelancer !== address) return false;
        if (role === "client" && i.client !== address) return false;
        if (!q) return true;
        const counterparty = i.freelancer === address ? i.client : i.freelancer;
        return (
          i.id.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.freelancer.toLowerCase().includes(q) ||
          i.client.toLowerCase().includes(q) ||
          counterparty.toLowerCase().includes(q) ||
          formatAmount(i.amount, getTokenConfig(i.token).decimals).includes(
            q,
          ) ||
          humanizeDescription(i.description).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [mine, query, status, role, address]);

  if (!isConfigured()) {
    return <Alert kind="info">The contract isn&apos;t configured yet.</Alert>;
  }

  if (!address) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Invoice history</h1>
          <p className="mt-1 text-sm text-slate-400">
            Search, filter and export every invoice you&apos;ve created or paid.
          </p>
        </div>
        <ConnectPrompt message="Connect your wallet to see your invoice history." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Invoice history</h1>
          <p className="mt-1 text-sm text-slate-400">
            Every invoice where you&apos;re the freelancer or the client, with
            search and filtering.
          </p>
        </div>
        <Link href="/statement" className="btn-ghost text-xs">
          Income statement
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className="input sm:max-w-xs"
          placeholder="Search id, description, address…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search invoices"
        />
        <div className="flex flex-wrap gap-2">
          {(["all", "Pending", "Paid"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`btn-ghost text-xs ${
                status === s ? "ring-1 ring-brand-400" : ""
              }`}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
          <span className="hidden w-px bg-white/10 sm:block" />
          {(["all", "freelancer", "client"] as RoleFilter[]).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`btn-ghost text-xs ${
                role === r ? "ring-1 ring-brand-400" : ""
              }`}
            >
              {r === "all"
                ? "Any role"
                : r === "freelancer"
                  ? "I invoiced"
                  : "I paid"}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="btn-ghost ml-auto text-xs"
        >
          {loading ? <Spinner /> : "Refresh"}
        </button>
      </div>

      <ScanStatus
        error={error}
        reachedCap={reachedCap}
        count={invoices.length}
        scannedThrough={scannedThrough}
        loading={loading}
        onRetry={load}
      />

      {loading && mine.length === 0 ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="card h-24 motion-reduce:animate-none animate-pulse bg-white/5"
            />
          ))}
        </div>
      ) : mine.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          subtitle="Create your first invoice and share the payment link with a client."
          action={
            <Link href="/create" className="btn-primary text-sm">
              Create invoice
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No matching invoices"
          subtitle="Try a different search or clear the filters."
          action={
            <button
              onClick={() => {
                setQuery("");
                setStatus("all");
                setRole("all");
              }}
              className="btn-ghost text-sm"
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((inv) => {
            const isFreelancer = inv.freelancer === address;
            const counterparty = isFreelancer ? inv.client : inv.freelancer;
            return (
              <div
                key={inv.id}
                className="card flex flex-wrap items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-400">
                      #{inv.id}
                    </span>
                    <StatusBadge status={inv.status} />
                    {isOverdue(inv) && <OverdueBadge />}
                  </div>
                  <p className="truncate text-sm font-medium">
                    {humanizeDescription(inv.description) || "—"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {isFreelancer ? "Client" : "Freelancer"}:{" "}
                    <AddressChip address={counterparty} />
                    {" · "}Created {formatDate(inv.createdAt)}
                    {inv.dueDate > 0n && ` · Due ${formatDate(inv.dueDate)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <TokenAmount
                    amount={inv.amount}
                    tokenId={inv.token}
                    className="font-semibold"
                  />
                  <Link
                    href={`/pay/${inv.id}`}
                    className="btn-ghost text-xs"
                    title="Open payment page"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => setPreview(inv)}
                    className="btn-ghost text-xs"
                    title="Preview / save as PDF"
                  >
                    PDF
                  </button>
                  {inv.status === "Pending" && (
                    <ShareMenu
                      invoice={inv}
                      buttonClassName="btn-ghost text-xs"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <InvoicePreview
        invoice={preview}
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        confirmLabel=""
      />
    </div>
  );
}
