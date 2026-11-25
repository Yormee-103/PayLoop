import type { Invoice } from "@/lib/contract";
import {
  averageTimeToPayDays,
  bucketMonthlyIncome,
  overdueTotalsByToken,
} from "@/lib/stats";
import { MonthlyIncomeChart } from "./charts/MonthlyIncomeChart";
import { TokenAmount } from "./TokenAmount";

export function IncomeOverview({ invoices }: { invoices: Invoice[] }) {
  const paid = invoices.filter((invoice) => invoice.status === "Paid");
  const { buckets } = bucketMonthlyIncome(paid);
  const averageDays = averageTimeToPayDays(invoices);
  const overdueTotals = overdueTotalsByToken(invoices);

  return (
    <section aria-labelledby="income-overview-heading" className="space-y-4">
      <div>
        <h2 id="income-overview-heading" className="text-lg font-semibold">
          Income overview
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Paid income by month, how quickly clients pay, and what is overdue.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MonthlyIncomeChart buckets={buckets} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="card">
            <p className="text-sm text-slate-400">Average time to pay</p>
            <p className="mt-1 text-2xl font-bold">
              {averageDays === null ? "—" : `${averageDays.toFixed(1)} days`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {paid.length === 0
                ? "No paid invoices yet"
                : `Across ${paid.length} paid invoice${paid.length === 1 ? "" : "s"}`}
            </p>
          </div>

          <div className="card">
            <p className="text-sm text-slate-400">Overdue total</p>
            {overdueTotals.size === 0 ? (
              <p className="mt-1 text-2xl font-bold">0</p>
            ) : (
              [...overdueTotals.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([tokenId, amount]) => (
                  <p key={tokenId} className="mt-1 text-2xl font-bold text-red-300">
                    <TokenAmount amount={amount} tokenId={tokenId} />
                  </p>
                ))
            )}
            <p className="mt-1 text-xs text-slate-500">
              Pending invoices past their due date
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
