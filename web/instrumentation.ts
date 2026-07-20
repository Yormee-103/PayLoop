// Next.js loads this on server/edge startup to wire up Sentry.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export async function onRequestError(...args: unknown[]) {
  const Sentry = await import("@sentry/nextjs");
  // @ts-expect-error - passthrough to Sentry's hook signature
  return Sentry.captureRequestError?.(...args);
}
