"use client";

import { useEffect } from "react";
import type { Invoice } from "@/lib/contract";
import { formatAmount, formatDate, humanizeDescription, shortAddress } from "@/lib/format";
import { config, explorer } from "@/lib/config";
import { StatusBadge } from "./ui";

// A clean, self-contained invoice sheet. Used for (a) the pre-send preview on
// the create page and (b) PDF export via the browser's print-to-PDF — the
// global @media print rules in globals.css show only the .print-area. No PDF
// library needed; the print dialog's "Save as PDF" produces a shareable file.

export function InvoiceDocument({
  invoice,
  txHash,
}: {
  invoice: Invoice;
  txHash?: string;
}) {
  const isPaid = invoice.status === "Paid";

  return (
    <div className="card invoice-print space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500 font-bold text-white">
            ₽
          </span>
          <div>
            <p className="font-bold tracking-tight">
              {isPaid ? "PayLoop Receipt" : "PayLoop"}
            </p>
            <p className="text-xs text-slate-400">
              {isPaid
                ? `Receipt #${invoice.id}${
                    invoice.paidAt > 0n
                      ? ` · Paid ${formatDate(invoice.paidAt)}`
                      : ""
                  }`
                : `Invoice #${invoice.id}`}
            </p>
          </div>
        </div>
        <StatusBadge status={invoice.status} />
      </div>

      <div>
        {isPaid && (
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Amount paid
          </p>
        )}
        <div
          className={`text-3xl font-bold tracking-tight ${
            isPaid ? "text-emerald-400" : ""
          }`}
        >
          {formatAmount(invoice.amount)}{" "}
          <span className="text-lg text-slate-400">{config.tokenSymbol}</span>
        </div>
      </div>

      <div className="space-y-2 rounded-lg bg-ink-900/60 p-4 text-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {isPaid ? "Paid by (client)" : "Billed to (client)"}
            </p>
            <p className="mt-0.5 font-mono text-xs">{invoice.client}</p>
          </div>
          <div className="flex-1 text-right">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {isPaid ? "Paid to (freelancer)" : "From (freelancer)"}
            </p>
            <p className="mt-0.5 font-mono text-xs">{invoice.freelancer}</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-x-6 gap-y-1 pt-2">
          <span className="text-slate-500">
            Created{" "}
            <span className="font-medium text-slate-300">
              {formatDate(invoice.createdAt)}
            </span>
          </span>
          {invoice.dueDate > 0n && (
            <span className="text-slate-500">
              Due{" "}
              <span className="font-medium text-slate-300">
                {formatDate(invoice.dueDate)}
              </span>
            </span>
          )}
          {isPaid && (
            <span className="text-slate-500">
              Settled{" "}
              <span className="font-medium text-emerald-300">
                {formatDate(invoice.paidAt)}
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="border-t border-white/10 pt-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          For services rendered
        </p>
        <p className="mt-1 text-slate-200">
          {humanizeDescription(invoice.description) || "—"}
        </p>
      </div>

      {isPaid ? (
        <div className="border-t border-white/10 pt-4 text-xs text-slate-500">
          <p className="font-semibold text-emerald-300">
            {formatAmount(invoice.amount)} {config.tokenSymbol} paid — settled
            on-chain in seconds on Stellar.
          </p>
          <div className="mt-2 space-y-1 font-mono text-[11px] text-slate-400">
            <p>Invoice ID: #{invoice.id}</p>
            <p>
              Contract:{" "}
              <a
                href={explorer.contract(config.contractId)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-300 underline hover:text-brand-200"
              >
                {config.contractId}
              </a>
            </p>
            {txHash && (
              <p>
                Transaction:{" "}
                <a
                  href={explorer.tx(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-300 underline hover:text-brand-200"
                >
                  {txHash}
                </a>
              </p>
            )}
          </div>
          <p className="mt-2 text-slate-500">
            Official receipt generated by PayLoop · Freelancer:{" "}
            {shortAddress(invoice.freelancer)}
          </p>
        </div>
      ) : (
        <div className="border-t border-white/10 pt-4 text-xs text-slate-500">
          <p className="font-semibold text-slate-300">
            {formatAmount(invoice.amount)} {config.tokenSymbol} due — settled
            on-chain in seconds on Stellar.
          </p>
          <p className="mt-1">
            Generated by PayLoop · Stellar testnet demo ·{" "}
            {shortAddress(invoice.freelancer)}
          </p>
        </div>
      )}
    </div>
  );
}

// Modal that previews an invoice and offers Edit / Save-as-PDF. The printable
// sheet sits inside a .print-area so the @media print rules isolate it.
export function InvoicePreview({
  invoice,
  open,
  onClose,
  onConfirm,
  confirming,
  confirmLabel = "Create invoice",
  txHash,
}: {
  invoice: Invoice | null;
  open: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  confirming?: boolean;
  confirmLabel?: string;
  txHash?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !invoice) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Invoice preview"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="print-area">
          <InvoiceDocument invoice={invoice} txHash={txHash} />
        </div>

        <div className="flex flex-wrap justify-end gap-2 print:hidden">
          <button onClick={onClose} className="btn-ghost text-sm">
            Edit
          </button>
          <button onClick={() => window.print()} className="btn-ghost text-sm">
            ⬇ Save as PDF
          </button>
          {onConfirm && (
            <button
              onClick={onConfirm}
              disabled={confirming}
              className="btn-primary text-sm"
            >
              {confirming ? "Creating…" : confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
