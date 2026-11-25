import { formatAmount, fromBaseUnits } from "@/lib/format";
import { getTokenConfig } from "@/lib/config";
import type { VolumeBucket } from "@/lib/stats";

export function VolumeChart({
  buckets,
  title,
  emptyTitle,
  emptyMessage,
}: {
  buckets: VolumeBucket[];
  title: string;
  emptyTitle: string;
  emptyMessage: string;
}) {
  if (buckets.length === 0) {
    return (
      <div className="card">
        <h2 className="text-sm font-semibold">{emptyTitle}</h2>
        <p className="mt-3 text-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  const humanFor = (b: VolumeBucket) =>
    Number(fromBaseUnits(b.amount, getTokenConfig(b.tokenId).decimals));
  const maxHuman = Math.max(...buckets.map(humanFor), 0) || 1;

  return (
    <div className="card space-y-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="flex h-32 items-end gap-2">
        {buckets.map((b) => {
          const human = humanFor(b);
          const pct = human > 0 ? Math.max((human / maxHuman) * 100, 4) : 0;
          const symbol = getTokenConfig(b.tokenId).symbol;
          return (
            <div
              key={b.key}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              title={`${b.label}: ${formatAmount(
                b.amount,
                getTokenConfig(b.tokenId).decimals
              )} ${symbol}`}
            >
              <div
                className="w-full rounded-t-md bg-brand-500"
                style={{ height: `${pct}%` }}
              />
              <span className="text-[10px] text-slate-500">{b.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
