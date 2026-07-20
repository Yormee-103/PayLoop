"use client";

import { useState } from "react";
import Link from "next/link";
import type { Invoice } from "@/lib/contract";
import { formatAmount, formatDate, shortAddress } from "@/lib/format";
import { config } from "@/lib/config";
import { StatusBadge } from "./ui";

export function InvoiceCard({
  invoice,
  role,
}: {
  invoice: Invoice;
  role: "freelancer" | "client";
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/pay/${invoice.id}`
        : `/pay/${invoice.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (e.g. insecure context) — fall back to navigation.
      window.location.href = `/pay/${invoice.id}`;
    }
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">Invoice #{invoice.id}</p>
          <p className="text-2xl font-bold">
            {formatAmount(invoice.amount)}{" "}
            <span className="text-base font-medium text-slate-400">
              {config.tokenSymbol}
            </span>
          </p>
        </div>
        <StatusBadge status={invoice.status} />
      </div>

      <p className="text-sm text-slate-300">{invoice.description || "—"}</p>

      <dl className="grid grid-cols-2 gap-2 text-xs text-slate-400">
        <div>
          <dt className="text-slate-500">
            {role === "freelancer" ? "Client" : "Freelancer"}
          </dt>
          <dd className="font-mono">
            {shortAddress(
              role === "freelancer" ? invoice.client : invoice.freelancer
            )}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Created</dt>
          <dd>{formatDate(invoice.createdAt)}</dd>
        </div>
        {invoice.dueDate > 0n && (
          <div>
            <dt className="text-slate-500">Due</dt>
            <dd>{formatDate(invoice.dueDate)}</dd>
          </div>
        )}
        {invoice.status === "Paid" && (
          <div>
            <dt className="text-slate-500">Paid</dt>
            <dd>{formatDate(invoice.paidAt)}</dd>
          </div>
        )}
      </dl>

      {invoice.status === "Pending" && role === "freelancer" && (
        <div className="flex gap-2">
          <button onClick={copyLink} className="btn-ghost flex-1 text-sm">
            {copied ? "Link copied ✓" : "Copy payment link"}
          </button>
          <Link
            href={`/pay/${invoice.id}`}
            className="btn-ghost text-sm"
            title="Open payment page"
          >
            Open
          </Link>
        </div>
      )}
    </div>
  );
}
