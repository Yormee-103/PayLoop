import type { VolumeBucket } from "@/lib/stats";
import { VolumeChart } from "./VolumeChart";

export function MonthlyIncomeChart({ buckets }: { buckets: VolumeBucket[] }) {
  return (
    <VolumeChart
      buckets={buckets}
      title="Income per month (per token)"
      emptyTitle="Income per month"
      emptyMessage="No paid invoices yet — income charts here once invoices are paid."
    />
  );
}
