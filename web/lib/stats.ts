import type { Invoice } from "./contract";

export type StatementSummary = {
  totalPaidCount: number;
  totalIncome: bigint;
  uniqueClientsCount: number;
  earliestPaidAt: bigint | null;
  latestPaidAt: bigint | null;
};

/**
 * Filter paid invoices for a freelancer within an optional start and end date.
 * Strictly filters by status === "Paid" and freelancer === freelancerAddress.
 * Supports date boundaries in YYYY-MM-DD or ISO format.
 */
export function filterStatementInvoices(
  invoices: Invoice[],
  freelancerAddress: string,
  startDate?: string | null,
  endDate?: string | null
): Invoice[] {
  if (!freelancerAddress) return [];

  const startTimestamp = startDate
    ? Math.floor(new Date(`${startDate}T00:00:00`).getTime() / 1000)
    : 0;
  const endTimestamp = endDate
    ? Math.floor(new Date(`${endDate}T23:59:59`).getTime() / 1000)
    : Infinity;

  return invoices
    .filter((inv) => {
      if (inv.status !== "Paid") return false;
      if (inv.freelancer.toLowerCase() !== freelancerAddress.toLowerCase()) return false;

      const eventTime = Number(inv.paidAt > 0n ? inv.paidAt : inv.createdAt);
      if (startTimestamp > 0 && !isNaN(startTimestamp) && eventTime < startTimestamp) {
        return false;
      }
      if (endTimestamp < Infinity && !isNaN(endTimestamp) && eventTime > endTimestamp) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      const timeA = a.paidAt > 0n ? a.paidAt : a.createdAt;
      const timeB = b.paidAt > 0n ? b.paidAt : b.createdAt;
      return timeA < timeB ? 1 : -1;
    });
}

/**
 * Calculates aggregates and totals for the statement summary card.
 */
export function calculateStatementSummary(invoices: Invoice[]): StatementSummary {
  let totalIncome = 0n;
  const clients = new Set<string>();
  let earliest: bigint | null = null;
  let latest: bigint | null = null;

  for (const inv of invoices) {
    totalIncome += inv.amount;
    if (inv.client) {
      clients.add(inv.client.toLowerCase());
    }
    const t = inv.paidAt > 0n ? inv.paidAt : inv.createdAt;
    if (earliest === null || t < earliest) {
      earliest = t;
    }
    if (latest === null || t > latest) {
      latest = t;
    }
  }

  return {
    totalPaidCount: invoices.length,
    totalIncome,
    uniqueClientsCount: clients.size,
    earliestPaidAt: earliest,
    latestPaidAt: latest,
  };
}
