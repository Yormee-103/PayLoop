export default function Loading() {
  return (
    <div
      className="grid place-items-center gap-3 py-24"
      role="status"
      aria-live="polite"
    >
      <span
        className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-brand-400"
        aria-hidden
      />
      <span className="text-sm text-slate-400">Loading…</span>
    </div>
  );
}
