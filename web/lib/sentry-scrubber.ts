import type { ErrorEvent, Breadcrumb } from "@sentry/nextjs";

/**
 * Scrubs Stellar public keys, contract IDs, muxed accounts, and secret keys
 * from URLs, breadcrumbs, strings, and event payloads to prevent leaking
 * wallet addresses to third-party error trackers.
 */

// Matches Stellar addresses:
// G... (Ed25519 public key, 56 chars)
// C... (Contract ID, 56 chars)
// M... (Muxed account, 69 chars)
// S... (Secret seed, 56 chars)
export const STELLAR_ADDRESS_REGEX = /\b[GCMS][A-Z2-7]{55,68}\b/g;

export function scrubStellarAddresses(text: string): string {
  if (!text || typeof text !== "string") return text;
  return text.replace(STELLAR_ADDRESS_REGEX, "[SCRUBBED_ADDRESS]");
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  if (breadcrumb.message) {
    breadcrumb.message = scrubStellarAddresses(breadcrumb.message);
  }
  if (breadcrumb.data) {
    for (const key of Object.keys(breadcrumb.data)) {
      const val = breadcrumb.data[key];
      if (typeof val === "string") {
        breadcrumb.data[key] = scrubStellarAddresses(val);
      }
    }
  }
  return breadcrumb;
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request?.url) {
    event.request.url = scrubStellarAddresses(event.request.url);
  }
  if (typeof event.request?.query_string === "string") {
    event.request.query_string = scrubStellarAddresses(
      event.request.query_string,
    );
  } else if (
    event.request?.query_string &&
    typeof event.request.query_string === "object"
  ) {
    const qs = event.request.query_string as Record<string, unknown>;
    for (const key of Object.keys(qs)) {
      const val = qs[key];
      if (typeof val === "string") {
        qs[key] = scrubStellarAddresses(val);
      }
    }
  }
  if (typeof event.request?.data === "string") {
    event.request.data = scrubStellarAddresses(event.request.data);
  }
  if (event.transaction) {
    event.transaction = scrubStellarAddresses(event.transaction);
  }
  if (event.message) {
    event.message = scrubStellarAddresses(event.message);
  }
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs.forEach(scrubBreadcrumb);
  }
  return event;
}
