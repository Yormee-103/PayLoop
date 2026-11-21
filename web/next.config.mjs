import { withSentryConfig } from "@sentry/nextjs";

/**
 * Builds the Content-Security-Policy directive string.
 *
 * Allowed Origins & Integrations:
 * - Soroban RPC & Horizon: https://*.stellar.org, https://soroban-testnet.stellar.org, https://horizon-testnet.stellar.org
 * - Explorer: https://stellar.expert
 * - Sentry Error Ingestion: https://*.sentry.io, https://*.ingest.sentry.io, https://*.ingest.us.sentry.io
 * - Vercel Analytics & Web Vitals: https://va.vercel-scripts.com, https://vitals.vercel-insights.com
 * - Freighter Wallet: DOM/window messaging via @stellar/freighter-api
 */
export function buildCsp(options = {}) {
  const isDev = process.env.NODE_ENV === "development";

  const directives = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      "'unsafe-eval'",
      "https://va.vercel-scripts.com",
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": [
      "'self'",
      "blob:",
      "data:",
      "https://*.stellar.org",
      "https://stellar.expert",
    ],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      "https://*.stellar.org",
      "https://soroban-testnet.stellar.org",
      "https://horizon-testnet.stellar.org",
      "https://stellar.expert",
      "https://*.sentry.io",
      "https://*.ingest.sentry.io",
      "https://*.ingest.us.sentry.io",
      "https://vitals.vercel-insights.com",
      "https://va.vercel-scripts.com",
      ...(isDev ? ["ws:", "http://localhost:*", "http://127.0.0.1:*"] : []),
    ],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
  };

  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");
}

/**
 * Returns the list of standard security headers applied across all routes.
 */
export function getSecurityHeaders() {
  const isReportOnly = process.env.CSP_REPORT_ONLY === "true";
  const cspHeaderName = isReportOnly
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";

  return [
    {
      key: cspHeaderName,
      value: buildCsp(),
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
      value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    },
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
    {
      key: "X-DNS-Prefetch-Control",
      value: "on",
    },
  ];
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: getSecurityHeaders(),
      },
    ];
  },
};

// Sentry wraps the config only when a DSN/org is configured, so local dev and
// CI without Sentry env vars still build cleanly.
const sentryEnabled =
  !!process.env.SENTRY_ORG && !!process.env.NEXT_PUBLIC_SENTRY_DSN;

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      disableLogger: true,
    })
  : nextConfig;
