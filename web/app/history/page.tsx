"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/components/WalletProvider";
import { Alert, EmptyState, Spinner, StatusBadge } from "@/components/ui";
import { InvoicePreview } from "@/components/InvoiceDocument";
import { getAllInvoices, type Invoice } from "@/lib/contract";
import { formatAmount, formatDate, shortAddress } from "@/lib/format";
import { config, isConfigured } from "@/lib/config";

type StatusFilter = "all" | "Pending" | "Paid";
type RoleFilter = "all" | "freelancer" | "client";

// Personal invoice history with search + status/role filtering. Addresses the
// top Level-4 feedback requests ("invoice history", "search and filtering").
export default function HistoryPage() {
  const { address, connect, connecting } = useWallet();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [role, setRole] = useState<RoleFilter>("all");
  const [preview, setPreview] = useState<Invoice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await getAllInvoices();
      setInvoices(all);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load invoice history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const mine = useMemo(() => {
    if (!address) return [];
    return invoices.filter(
      (i) => i.freelancer === address || i.client === address
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
        const counterparty =
          i.freelancer === address ? i.client : i.freelancer;
        return (
          i.id.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.freelancer.toLowerCase().includes(q) ||
          i.client.toLowerCase().includes(q) ||
          counterparty.toLowerCase().includes(q) ||
          formatAmount(i.amount).includes(q)
        );
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [mine, query, status, role, address]);

  if (!isConfigured()) {
    return (
      <Alert kind="info">The contract isn&apos;t configured yet.</Alert>
    );
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
        <div className="card flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-slate-300">
            Connect your wallet to see your invoice history.
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
      <div>
        <h1 className="text-2xl font-bold">Invoice history</h1>
        <p className="mt-1 text-sm text-slate-400">
          Every invoice where you&apos;re the freelancer or the client, with
          search and filtering.
        </p>
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
              {r === "all" ? "Any role" : r === "freelancer" ? "I invoiced" : "I paid"}
            </button>
          ))}
        </div>
        <button onClick={load} disabled={loading} className="btn-ghost ml-auto text-xs">
          {loading ? <Spinner /> : "Refresh"}
        </button>
      </div>

      {error && (
        <Alert kind="error">
          <span>{error}</span>{" "}
          <button onClick={load} className="ml-2 underline">
            Retry
          </button>
        </Alert>
      )}

      {loading && mine.length === 0 ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-24 animate-pulse bg-white/5" />
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
                  </div>
                  <p className="truncate text-sm font-medium">
                    {inv.description || "—"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {isFreelancer ? "Client" : "Freelancer"}:{" "}
                    <span className="font-mono">{shortAddress(counterparty)}</span>
                    {" · "}Created {formatDate(inv.createdAt)}
                    {inv.dueDate > 0n && ` · Due ${formatDate(inv.dueDate)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">
                    {formatAmount(inv.amount)}{" "}
                    <span className="text-xs font-normal text-slate-400">
                      {config.tokenSymbol}
                    </span>
                  </span>
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
                    <CopyReminderButton invoice={inv} />
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

// Copies a ready-to-send payment reminder message to the clipboard. Covers the
// Level-4 "payment reminders" feedback request.
function CopyReminderButton({ invoice }: { invoice: Invoice }) {
  const [copied, setCopied] = useState(false);

  async function remind() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/pay/${invoice.id}`
        : `/pay/${invoice.id}`;
    const text = `Hi! You have an outstanding PayLoop invoice #${invoice.id} for ${formatAmount(
      invoice.amount
    )} ${config.tokenSymbol} (${invoice.description || "no description"}). Please pay it here: ${url}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.location.href = `/pay/${invoice.id}`;
    }
  }

  return (
    <button onClick={remind} className="btn-ghost text-xs" title="Copy payment reminder">
      {copied ? "Copied ✓" : "Remind"}
    </button>
  );
}
