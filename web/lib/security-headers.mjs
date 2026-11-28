const DEFAULT_RPC_URL = "https://soroban-testnet.stellar.org";
const DEFAULT_HORIZON_URL = "https://horizon-testnet.stellar.org";

const SENTRY_INGEST_ORIGINS = [
  "https://*.ingest.sentry.io",
  "https://*.ingest.us.sentry.io",
  "https://*.ingest.de.sentry.io",
];

const VERCEL_ANALYTICS_SCRIPT_ORIGIN = "https://va.vercel-scripts.com";
const VERCEL_ANALYTICS_CONNECT_ORIGINS = [
  "https://va.vercel-scripts.com",
  "https://vitals.vercel-insights.com",
];

/**
 * Safely extracts an origin (`scheme://host[:port]`) from a URL string.
 * Returns `null` for empty, missing, malformed, or opaque-origin URLs.
 */
export function extractOrigin(rawUrl) {
  if (typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.origin && parsed.origin !== "null" ? parsed.origin : null;
  } catch {
    return null;
  }
}

/**
 * Builds the full Content-Security-Policy directive string for PayLoop.
 * Allows Soroban RPC, Horizon, Sentry (including Replay blob workers), and
 * Vercel Analytics while keeping frame/object/base/form directives strict.
 */
export function buildCspDirectives(env = process.env) {
  const isProd = env.NODE_ENV === "production";

  const rpcOrigin = extractOrigin(env.NEXT_PUBLIC_RPC_URL ?? DEFAULT_RPC_URL);
  const horizonOrigin = extractOrigin(
    env.NEXT_PUBLIC_HORIZON_URL ?? DEFAULT_HORIZON_URL,
  );
  const sentryOrigin = extractOrigin(env.NEXT_PUBLIC_SENTRY_DSN);

  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    VERCEL_ANALYTICS_SCRIPT_ORIGIN,
  ];
  if (!isProd) {
    scriptSrc.push("'unsafe-eval'");
  }

  const connectCandidates = [
    "'self'",
    rpcOrigin,
    horizonOrigin,
    sentryOrigin,
    ...SENTRY_INGEST_ORIGINS,
    ...VERCEL_ANALYTICS_CONNECT_ORIGINS,
  ];
  if (!isProd) {
    connectCandidates.push("ws:", "wss:");
  }

  const connectSrc = [...new Set(connectCandidates.filter(Boolean))];

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    `script-src ${scriptSrc.join(" ")}`,
    "worker-src 'self' blob:",
    `connect-src ${connectSrc.join(" ")}`,
  ];

  const isHttpsDeployment =
    env.VERCEL === "1" || (env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");
  if (isHttpsDeployment) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

/**
 * Low-risk structural CSP enforced during Report-Only rollout so clickjacking,
 * plugin objects, base-tag hijacking, and external form submission are blocked
 * immediately and security scanners recognize an active Content-Security-Policy.
 */
export function buildStructuralEnforcingCsp() {
  return "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'";
}

/**
 * Returns the HTTP security headers applied to all Next.js routes.
 * By default (`CSP_ENFORCE !== "true"`), ships the full CSP in Report-Only mode
 * alongside the structural enforcing CSP; set `CSP_ENFORCE=true` to enforce
 * the full policy directly.
 */
export function buildSecurityHeaders(env = process.env) {
  const fullCsp = buildCspDirectives(env);
  const enforceFullCsp = env.CSP_ENFORCE === "true";

  // Keep clipboard-write allowed because AddressChip, InvoiceCard, and ShareMenu
  // copy addresses, payment links, and reminders via navigator.clipboard.
  const headers = [
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
  ];

  if (enforceFullCsp) {
    headers.push({
      key: "Content-Security-Policy",
      value: fullCsp,
    });
  } else {
    headers.push(
      {
        key: "Content-Security-Policy",
        value: buildStructuralEnforcingCsp(),
      },
      {
        key: "Content-Security-Policy-Report-Only",
        value: fullCsp,
      },
    );
  }

  return headers;
}
