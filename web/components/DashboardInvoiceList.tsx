"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Invoice } from "@/lib/contract";
import { isOverdue } from "@/lib/invoice-helpers";
import { EmptyState } from "./ui";
import { InvoiceCard } from "./InvoiceCard";

const TABS = [
  { id: "all", label: "All" },
  { id: "Pending", label: "Pending" },
  { id: "Paid", label: "Paid" },
  { id: "Overdue", label: "Overdue" },
] as const;

type StatusTab = (typeof TABS)[number]["id"];
type InvoiceSort = "newest" | "oldest" | "amount-high" | "amount-low";

const SORT_OPTIONS: { value: InvoiceSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "amount-high", label: "Amount: high to low" },
  { value: "amount-low", label: "Amount: low to high" },
];

function compareBigInt(a: bigint, b: bigint): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

function compareInvoiceIds(a: Invoice, b: Invoice): number {
  if (/^\d+$/.test(a.id) && /^\d+$/.test(b.id)) {
    return compareBigInt(BigInt(a.id), BigInt(b.id));
  }
  return a.id.localeCompare(b.id);
}

function compareInvoices(a: Invoice, b: Invoice, sort: InvoiceSort): number {
  let result = 0;
  if (sort === "newest" || sort === "oldest") {
    result = compareBigInt(a.createdAt, b.createdAt);
    if (sort === "newest") result = -result;
  } else {
    result = compareBigInt(a.amount, b.amount);
    if (sort === "amount-high") result = -result;
  }
  if (result !== 0) return result;

  result = compareBigInt(b.createdAt, a.createdAt);
  if (result !== 0) return result;
  return compareInvoiceIds(b, a);
}

export function DashboardInvoiceList({ invoices }: { invoices: Invoice[] }) {
  const [activeTab, setActiveTab] = useState<StatusTab>("all");
  const [sort, setSort] = useState<InvoiceSort>("newest");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const counts = useMemo<Record<StatusTab, number>>(() => {
    const next: Record<StatusTab, number> = {
      all: invoices.length,
      Pending: 0,
      Paid: 0,
      Overdue: 0,
    };
    const nowMs = Date.now();
    for (const invoice of invoices) {
      if (invoice.status === "Pending") next.Pending += 1;
      if (invoice.status === "Paid") next.Paid += 1;
      if (isOverdue(invoice, nowMs)) next.Overdue += 1;
    }
    return next;
  }, [invoices]);

  const visible = useMemo(() => {
    const nowMs = Date.now();
    const filtered = invoices.filter((invoice) => {
      if (activeTab === "all") return true;
      if (activeTab === "Pending") return invoice.status === "Pending";
      if (activeTab === "Paid") return invoice.status === "Paid";
      return isOverdue(invoice, nowMs);
    });
    return [...filtered].sort((a, b) => compareInvoices(a, b, sort));
  }, [invoices, activeTab, sort]);

  function activateTab(index: number, focus = false) {
    const tab = TABS[index];
    if (!tab) return;
    setActiveTab(tab.id);
    if (focus) tabRefs.current[index]?.focus();
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % TABS.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + TABS.length) % TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = TABS.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    activateTab(nextIndex, true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Filter invoices by status"
          className="flex flex-wrap gap-1 border-b border-white/10"
        >
          {TABS.map((tab, index) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                type="button"
                role="tab"
                id={`dashboard-invoice-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls="dashboard-invoices-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => activateTab(index)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
                  selected
                    ? "border-brand-400 text-brand-200"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>{tab.label}</span>{" "}
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[11px]">
                  {counts[tab.id]}
                </span>
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-400">
          Sort
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as InvoiceSort)}
            className="input w-auto py-1.5 text-xs"
            aria-label="Sort invoices"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        role="tabpanel"
        id="dashboard-invoices-panel"
        aria-labelledby={`dashboard-invoice-tab-${activeTab}`}
      >
        {visible.length === 0 ? (
          <EmptyState
            title="No invoices in this view"
            subtitle="Try another status tab to see the rest of your invoices."
            action={
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className="btn-ghost text-sm"
              >
                Show all invoices
              </button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {visible.map((invoice) => (
              <InvoiceCard
                key={invoice.id}
                invoice={invoice}
                role="freelancer"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
