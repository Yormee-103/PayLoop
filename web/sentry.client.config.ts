// Sentry browser init. No-op unless NEXT_PUBLIC_SENTRY_DSN is set, so the app
// runs cleanly without a Sentry account.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    environment: process.env.NEXT_PUBLIC_NETWORK ?? "testnet",
  });
}
