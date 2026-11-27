import type { Invoice } from "./contract";
import { isInvoiceOverdue } from "./invoice-status.ts";

export type ClientInvoiceSummary = {
  invoices: Invoice[];
  count: number;
  totalOwed: bigint;
  overdueCount: number;
};

// The global scan contains every invoice on the contract. A client only cares
// about pending invoices billed to their address, newest first.
export function deriveClientInvoices(
  scanned: Invoice[],
  address: string | null,
  nowMs: number = Date.now()
): ClientInvoiceSummary {
  if (!address) {
    return { invoices: [], count: 0, totalOwed: 0n, overdueCount: 0 };
  }

  const invoices = scanned
    .filter((invoice) => invoice.status === "Pending" && invoice.client === address)
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : a.createdAt < b.createdAt ? 1 : 0));

  return {
    invoices,
    count: invoices.length,
    totalOwed: invoices.reduce((sum, invoice) => sum + invoice.amount, 0n),
    overdueCount: invoices.filter((invoice) => isInvoiceOverdue(invoice, nowMs)).length,
  };
}
