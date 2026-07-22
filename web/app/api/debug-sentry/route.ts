import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

// Debug-only endpoint to verify Sentry is receiving events. Captures a test
// exception and flushes it, so the Sentry dashboard shows a real issue. Guarded
// so it does nothing unless a DSN is configured. Safe to keep — it never throws
// unhandled and exposes no data.
export async function GET() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return NextResponse.json(
      { ok: false, reason: "Sentry DSN not configured on the server." },
      { status: 503 }
    );
  }

  const err = new Error(
    "PayLoop Sentry test event — monitoring is live (safe to ignore)."
  );
  const eventId = Sentry.captureException(err);
  await Sentry.flush(3000);

  return NextResponse.json({ ok: true, eventId });
}
