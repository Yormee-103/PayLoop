"use client";

import { explorer } from "@/lib/config";
import type { InvoiceStatus } from "@/lib/contract";

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  if (status === "Paid") {
    return (
      <span className="badge bg-emerald-500/15 text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Paid
      </span>
    );
  }
  return (
    <span className="badge bg-amber-500/15 text-amber-300">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Pending
    </span>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white ${className}`}
      aria-hidden
    />
  );
}

export function Alert({
  kind = "error",
  children,
}: {
  kind?: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  const styles = {
    error: "border-red-500/30 bg-red-500/10 text-red-200",
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    info: "border-brand-500/30 bg-brand-500/10 text-brand-100",
  }[kind];
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${styles}`} role="alert">
      {children}
    </div>
  );
}

export function TxLink({ hash, label = "View on explorer" }: { hash: string; label?: string }) {
  return (
    <a
      href={explorer.tx(hash)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-brand-300 underline-offset-2 hover:underline"
    >
      {label} ↗
    </a>
  );
}

export function EmptyState({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-white/5 text-2xl">
        📄
      </div>
      <div>
        <p className="font-semibold">{title}</p>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
