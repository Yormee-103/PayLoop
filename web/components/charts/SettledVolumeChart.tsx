import type { VolumeBucket } from "@/lib/stats";
import { VolumeChart } from "./VolumeChart";

export function SettledVolumeChart({
  granularity,
  buckets,
}: {
  granularity: "day" | "week";
  buckets: VolumeBucket[];
}) {
  return (
    <VolumeChart
      buckets={buckets}
      title={`Settled volume by ${granularity} (per token)`}
      emptyTitle={`Settled volume by ${granularity}`}
      emptyMessage="No paid invoices yet — settled volume charts here once invoices are paid."
    />
  );
}
