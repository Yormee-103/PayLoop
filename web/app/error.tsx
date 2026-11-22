"use client";

import { useEffect } from "react";
import Link from "next/link";

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
          We encountered an unexpected error while processing your request. Please try again or return to the home page.
        </p>
        {error.digest ? (
          <p className="text-xs font-mono text-slate-500">
            Reference ID: {error.digest}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button onClick={reset} className="btn-primary">
            Try again
          </button>
          <Link href="/" className="btn-secondary">
            Go home
          </Link>
          <Link
            href="/help"
            className="text-sm text-slate-400 hover:text-white transition-colors py-2 px-3"
          >
            Report a problem
          </Link>
        </div>
      </div>
    </div>
  );
}
