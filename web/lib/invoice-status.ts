import type { Invoice } from "./contract";

// Shared overdue rule for cards, reminders and the client dashboard section.
// A zero dueDate means the invoice has no deadline.
export function isInvoiceOverdue(
  invoice: Pick<Invoice, "status" | "dueDate">,
  nowMs: number = Date.now()
): boolean {
  return (
    invoice.status === "Pending" &&
    invoice.dueDate > 0n &&
    invoice.dueDate * 1000n < BigInt(nowMs)
  );
}
