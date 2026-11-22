import type { InvoiceStatus } from "./contract";

/**
 * Converts a "YYYY-MM-DD" date picker string into a Unix timestamp in seconds
 * representing the end of that day (23:59:59.999) in the user's local timezone.
 * Returns 0n if empty or invalid.
 */
export function dueDateToUnix(dateStr?: string | null): bigint {
  if (!dateStr) return 0n;
  const parts = dateStr.trim().split("-");
  if (parts.length !== 3) return 0n;
  const [year, month, day] = parts.map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return 0n;
  // Construct date at 23:59:59 in the local timezone
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
  return BigInt(Math.floor(endOfDay.getTime() / 1000));
}

/**
 * Determines whether a pending invoice is overdue.
 * An invoice due today is NOT overdue until the entire day has elapsed.
 */
export function isOverdue(
  invoice: { status: InvoiceStatus | string; dueDate: bigint | number },
  nowMs: number = Date.now()
): boolean {
  if (invoice.status !== "Pending") return false;
  const dueSec =
    typeof invoice.dueDate === "bigint"
      ? Number(invoice.dueDate)
      : invoice.dueDate;
  if (!dueSec || dueSec <= 0) return false;
  return dueSec * 1000 < nowMs;
}
