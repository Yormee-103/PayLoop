// Small, dependency-free helpers shared by the create form, the invoice sheet
// and the pay page. Kept free of React/config imports so they can be unit
// tested with plain `node --test` (see lib/__tests__/invoice-helpers.test.mjs).

/** Today's date in the user's local timezone as `YYYY-MM-DD` (a date input's value format). */
export function todayDateInputValue(now: Date = new Date()): string {
  const y = String(now.getFullYear()).padStart(4, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const DATE_INPUT = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates the optional due date from the create form (issue #66).
 * An empty value is allowed ("no due date"). Today counts as valid; any earlier
 * day is rejected. Both values are zero-padded `YYYY-MM-DD`, so comparing them
 * as strings is the same as comparing the dates.
 */
export function dueDateError(
  value: string,
  today: string = todayDateInputValue(),
): string | null {
  if (!value) return null;
  if (!DATE_INPUT.test(value)) return "Enter a valid due date.";
  if (value < today) {
    return "The due date can't be in the past. Pick today or a later date.";
  }
  return null;
}

/**
 * Document title used while an invoice sheet is open, so "Save as PDF" proposes
 * a meaningful filename (issue #67): `PayLoop-Invoice-<id>`, or
 * `PayLoop-Receipt-<id>` once the invoice is paid.
 */
export function invoicePrintTitle(invoice: {
  id: string;
  status: string;
}): string {
  // The id lands in a filename: keep it to filename-safe characters. A not-yet
  // created invoice (preview) has the placeholder id "—", which is dropped.
  const id = String(invoice.id).replace(/[^A-Za-z0-9_-]/g, "");
  const kind = invoice.status === "Paid" ? "Receipt" : "Invoice";
  return id ? `PayLoop-${kind}-${id}` : `PayLoop-${kind}`;
}

/** True when `address` is the invoice's freelancer, and not also its client (issue #69). */
export function isInvoiceOwner(
  address: string | null | undefined,
  invoice: { freelancer: string; client: string },
): boolean {
  return (
    Boolean(address) &&
    address === invoice.freelancer &&
    address !== invoice.client
  );
}

/** Plain-text reminder a freelancer can paste to their client. */
export function buildReminderMessage(args: {
  id: string;
  amountLabel: string;
  description: string;
  url: string;
}): string {
  return `Hi! You have an outstanding PayLoop invoice #${args.id} for ${args.amountLabel} (${
    args.description || "no description"
  }). Please pay it here: ${args.url}`;
}

/** URL for creating a new invoice with the same client and work details. */
export function buildCreateInvoiceUrl(args: {
  client: string;
  amount: string;
  description: string;
}): string {
  const params = new URLSearchParams(args);
  return `/create?${params.toString()}`;
}

/**
 * True when an invoice is still Pending and its due date has passed (issue #70).
 * Shared by every screen so the Overdue badge and the dashboard count agree.
 * Paid invoices and invoices without a due date (`dueDate === 0n`) never are.
 * `dueDate` is a unix timestamp in seconds; `nowMs` is a millisecond clock.
 */
export function isOverdue(
  invoice: { status: string; dueDate: bigint },
  nowMs: number = Date.now(),
): boolean {
  return (
    invoice.status === "Pending" &&
    invoice.dueDate > 0n &&
    invoice.dueDate * 1000n < BigInt(Math.floor(nowMs))
  );
}


// Converts a raw token `balance` read into a bigint. A missing value is an
// error, not a zero balance (issue #60): only an explicit 0 means "0".
export function parseTokenBalance(raw: unknown): bigint {
  if (raw === null || raw === undefined) {
    throw new Error("Could not read token balance.");
  }
  return BigInt(String(raw));
const U64_MAX = 18446744073709551615n;

// True when `id` is a canonical invoice id: digits only and at most u64::MAX
// (issue #59). Anything else cannot exist on-chain, so callers should treat it
// as "not found" without making an RPC call.
export function isValidInvoiceId(id: string): boolean {
  return /^\d+$/.test(id) && BigInt(id) <= U64_MAX;
}
