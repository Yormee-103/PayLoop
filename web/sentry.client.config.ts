// Sentry browser init. No-op unless NEXT_PUBLIC_SENTRY_DSN is set, so the app
// runs cleanly without a Sentry account.
import * as Sentry from "@sentry/nextjs";
import { scrubEvent, scrubBreadcrumb } from "./lib/sentry-scrubber";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  const release =
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_COMMIT_SHA ||
    process.env.npm_package_version ||
    "development";

  Sentry.init({
    dsn,
    release,
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    environment: process.env.NEXT_PUBLIC_NETWORK ?? "testnet",
    beforeSend(event) {
      return scrubEvent(event);
    },
    beforeBreadcrumb(breadcrumb) {
      return scrubBreadcrumb(breadcrumb);
    },
  });
}
