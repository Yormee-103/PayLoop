export function StatusSplitBar({
  paid,
  pending,
}: {
  paid: number;
  pending: number;
}) {
  const total = paid + pending;
  if (total === 0) return null;
  const paidPct = (paid / total) * 100;

  return (
    <div className="card space-y-3">
      <h2 className="text-sm font-semibold">Paid vs pending</h2>
      <div className="flex h-3 overflow-hidden rounded-full bg-white/5">
        {paid > 0 && (
          <div
            className="h-full bg-emerald-400"
            style={{ width: `${paidPct}%` }}
            title={`${paid} paid`}
          />
        )}
        {pending > 0 && (
          <div
            className="h-full bg-amber-400"
            style={{ width: `${100 - paidPct}%` }}
            title={`${pending} pending`}
          />
        )}
      </div>
      <div className="flex gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> Paid (
          {paid})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> Pending (
          {pending})
        </span>
      </div>
    </div>
  );
}
