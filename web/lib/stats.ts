import type { Invoice } from "./contract.ts";
import { isOverdue } from "./invoice-helpers.ts";

export type VolumeGranularity = "day" | "week" | "month";

export type VolumeBucket = {
  key: string;
  label: string;
  amount: bigint;
  tokenId: string;
};

type PaidVolumeResult<G extends VolumeGranularity = VolumeGranularity> = {
  granularity: G;
  buckets: VolumeBucket[];
};

function bucketStart(date: Date, granularity: VolumeGranularity): Date {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  if (granularity === "week") {
    const dayOfWeek = (start.getUTCDay() + 6) % 7; // Monday = 0
    start.setUTCDate(start.getUTCDate() - dayOfWeek);
  }
  if (granularity === "month") {
    start.setUTCDate(1);
  }
  return start;
}

function bucketPaidVolume<G extends VolumeGranularity>(
  paidInvoices: Invoice[],
  granularity: G,
): PaidVolumeResult<G> {
  const withDates = paidInvoices.filter((i) => i.paidAt > 0n);
  if (withDates.length === 0) return { granularity, buckets: [] };

  const map = new Map<
    string,
    { start: Date; amount: bigint; tokenId: string }
  >();
  for (const inv of withDates) {
    const start = bucketStart(new Date(Number(inv.paidAt) * 1000), granularity);
    const key = `${start.toISOString().slice(0, 10)}:${inv.token}`;
    const entry = map.get(key) ?? { start, amount: 0n, tokenId: inv.token };
    entry.amount += inv.amount;
    map.set(key, entry);
  }

  const buckets = [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([key, { start, amount, tokenId }]) => ({
      key,
      label:
        granularity === "month"
          ? start.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : start.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            }),
      amount,
      tokenId,
    }));

  return { granularity, buckets };
}

// Groups paid invoices by paidAt into day buckets, or week buckets (Mon-start,
// UTC) once the paid history spans more than 3 weeks — keeps the chart legible
// without a date-range picker. Shows only the most recent 12 buckets.
export function bucketSettledVolume(paidInvoices: Invoice[]): {
  granularity: "day" | "week";
  buckets: VolumeBucket[];
} {
  const withDates = paidInvoices.filter((i) => i.paidAt > 0n);
  if (withDates.length === 0) return { granularity: "day", buckets: [] };

  const times = withDates.map((i) => Number(i.paidAt) * 1000);
  const spanDays = (Math.max(...times) - Math.min(...times)) / 86_400_000;
  const granularity: "day" | "week" = spanDays > 21 ? "week" : "day";

  return bucketPaidVolume(paidInvoices, granularity);
}

export function bucketMonthlyIncome(paidInvoices: Invoice[]): {
  granularity: "month";
  buckets: VolumeBucket[];
} {
  const result = bucketPaidVolume(paidInvoices, "month");
  return { granularity: "month", buckets: result.buckets };
}

/**
 * Average number of days between invoice creation and payment. Invoices
 * without both timestamps (or with a negative interval) are ignored.
 */
export function averageTimeToPayDays(
  invoices: Pick<Invoice, "status" | "createdAt" | "paidAt">[],
): number | null {
  let totalSeconds = 0;
  let count = 0;
  for (const invoice of invoices) {
    if (
      invoice.status !== "Paid" ||
      invoice.createdAt <= 0n ||
      invoice.paidAt < invoice.createdAt
    ) {
      continue;
    }
    totalSeconds += Number(invoice.paidAt - invoice.createdAt);
    count += 1;
  }
  return count === 0 ? null : totalSeconds / count / 86_400;
}

/** Overdue invoice amounts grouped by token; different tokens are never summed. */
export function overdueTotalsByToken(
  invoices: Pick<Invoice, "status" | "dueDate" | "amount" | "token">[],
  nowMs: number = Date.now(),
): Map<string, bigint> {
  const totals = new Map<string, bigint>();
  for (const invoice of invoices) {
    if (!isOverdue(invoice, nowMs)) continue;
    totals.set(
      invoice.token,
      (totals.get(invoice.token) ?? 0n) + invoice.amount,
    );
  }
  return totals;
}
