export default function Loading() {
  return (
    <div className="grid place-items-center py-24" role="status" aria-label="Loading page">
      <span
        className="h-8 w-8 animate-spin motion-reduce:animate-none rounded-full border-2 border-white/20 border-t-brand-400"
        aria-hidden="true"
      />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
