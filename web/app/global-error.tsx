"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    import("@sentry/nextjs")
      .then((S) => S.captureException?.(error))
      .catch(() => {});
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          background: "#0b1220",
          color: "#e2e8f0",
          display: "grid",
          placeItems: "center",
          height: "100vh",
          margin: 0,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 480, padding: 24 }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 12px" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#94a3b8", margin: "0 0 16px" }}>
            An unexpected error occurred. Please try again or return to the home page.
          </p>
          {error.digest ? (
            <p
              style={{
                fontSize: "0.75rem",
                fontFamily: "monospace",
                color: "#64748b",
                margin: "0 0 16px",
              }}
            >
              Reference ID: {error.digest}
            </p>
          ) : null}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={reset}
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: "none",
                background: "#3390fc",
                color: "white",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Try again
            </button>
            <Link
              href="/"
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)",
                color: "white",
                textDecoration: "none",
                fontWeight: 600,
                display: "inline-block",
              }}
            >
              Go home
            </Link>
            <Link
              href="/help"
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                color: "#94a3b8",
                textDecoration: "none",
                fontWeight: 500,
                display: "inline-block",
              }}
            >
              Report a problem
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
