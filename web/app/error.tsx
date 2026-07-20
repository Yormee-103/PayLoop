"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report to Sentry if configured.
    import("@sentry/nextjs")
      .then((S) => S.captureException?.(error))
      .catch(() => {});
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <div className="card space-y-4">
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="text-sm text-slate-400">
          {error.message || "An unexpected error occurred."}
        </p>
        <button onClick={reset} className="btn-primary">
          Try again
        </button>
      </div>
    </div>
  );
}
