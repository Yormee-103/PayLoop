"use client";

import { useState } from "react";
import Link from "next/link";
import type { Invoice } from "@/lib/contract";
import {
  formatAmount,
  formatDate,
  fromBaseUnits,
  humanizeDescription,
} from "@/lib/format";
import { useTokenMeta } from "@/lib/use-token-meta";
import { StatusBadge, OverdueBadge } from "./ui";
import { AddressChip } from "./AddressChip";
import { isOverdue } from "@/lib/invoice-helpers";
import { InvoicePreview } from "./InvoiceDocument";
import { ShareMenu } from "./ShareMenu";
import { buildCreateInvoiceUrl } from "@/lib/invoice-helpers";

export function InvoiceCard({
  invoice,
  role,
}: {
  invoice: Invoice;
  role: "freelancer" | "client";
}) {
  const [copied, setCopied] = useState(false);
  const [reminded, setReminded] = useState(false);
  const [preview, setPreview] = useState(false);
  const token = useTokenMeta(invoice.token);

  function link() {
    return typeof window !== "undefined"
      ? `${window.location.origin}/pay/${invoice.id}`
      : `/pay/${invoice.id}`;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (e.g. insecure context) — fall back to navigation.
      window.location.href = link();
    }
  }

  async function copyReminder() {
    const text = `Hi! You have an outstanding PayLoop invoice #${invoice.id} for ${formatAmount(
      invoice.amount,
      token.decimals,
    )} ${token.symbol} (${humanizeDescription(invoice.description) || "no description"}). Please pay it here: ${link()}`;
    try {
      await navigator.clipboard.writeText(text);
      setReminded(true);
      setTimeout(() => setReminded(false), 2000);
    } catch {
      window.location.href = link();
    }
  }

  const overdue = isOverdue(invoice);

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">
            Invoice #{invoice.id}
            {overdue && <OverdueBadge className="ml-2" />}
          </p>
          <p className="text-2xl font-bold">
            {formatAmount(invoice.amount, token.decimals)}{" "}
            <span className="text-base font-medium text-slate-400">
              {token.symbol}
            </span>
          </p>
        </div>
        <StatusBadge status={invoice.status} />
      </div>

      <p className="text-sm text-slate-300">
        {humanizeDescription(invoice.description) || "—"}
      </p>

      <dl className="grid grid-cols-2 gap-2 text-xs text-slate-400">
        <div>
          <dt className="text-slate-500">
            {role === "freelancer" ? "Client" : "Freelancer"}
          </dt>
          <dd>
            <AddressChip
              address={
                role === "freelancer" ? invoice.client : invoice.freelancer
              }
            />
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
        <div className="flex flex-wrap gap-2">
          <button onClick={copyLink} className="btn-ghost flex-1 text-sm">
            {copied ? "Link copied ✓" : "Copy payment link"}
          </button>
          <ShareMenu invoice={invoice} buttonClassName="btn-ghost text-sm" />
          <button
            onClick={copyReminder}
            className="btn-ghost text-sm"
            title="Copy a payment reminder message"
          >
            {reminded ? "Copied ✓" : "Remind"}
          </button>
          <Link
            href={`/pay/${invoice.id}`}
            className="btn-ghost text-sm"
            title="Open payment page"
          >
            Open
          </Link>
          <button
            onClick={() => setPreview(true)}
            className="btn-ghost text-sm"
            title="Preview / save as PDF"
          >
            PDF
          </button>
        </div>
      )}

      <div>
        <Link
          href={buildCreateInvoiceUrl({
            client: invoice.client,
            amount: fromBaseUnits(invoice.amount, token.decimals),
            description: invoice.description,
          })}
          className="btn-ghost text-sm"
          title="Create a similar invoice"
        >
          Duplicate
        </Link>
      </div>

      {invoice.status === "Pending" && role === "client" && (
        <Link href={`/pay/${invoice.id}`} className="btn-primary w-full text-sm">
          Pay now
        </Link>
      )}

      <InvoicePreview
        invoice={invoice}
        open={preview}
        onClose={() => setPreview(false)}
        confirmLabel=""
      />
    </div>
  );
}
