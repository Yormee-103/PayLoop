"use client";

import { useEffect } from "react";

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
        <div style={{ textAlign: "center", padding: 16 }}>
          <h1>Something went wrong</h1>
          <p style={{ color: "#94a3b8", fontSize: 14 }}>
            We couldn't load this page. Please try again. If the problem keeps
            happening, let us know and include the reference ID below.
          </p>
          {error.digest && (
            <p style={{ color: "#64748b", fontSize: 12 }}>
              Reference ID: <code>{error.digest}</code>
            </p>
          )}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 12,
              marginTop: 16,
            }}
          >
            <button
              onClick={reset}
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: "none",
                background: "#3390fc",
                color: "white",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a href="/" style={{ color: "#3390fc", alignSelf: "center" }}>
              Go home
            </a>
            <a href="/contact" style={{ color: "#3390fc", alignSelf: "center" }}>
              Report a problem
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
