import { withSentryConfig } from "@sentry/nextjs";
import { buildSecurityHeaders } from "./lib/security-headers.mjs";
import bundleAnalyzer from "@next/bundle-analyzer";

// Issue #34 adds wallet providers that talk to browser extensions, helper
// iframes and websockets. Issue #23 wants CSP rolled out in Report-Only mode
// first, so these directives collect violations without blocking the app.
const walletOrigins = [
  "https://*.freighter.app",
  "https://xbull.app",
  "https://*.xbull.app",
  "https://albedo.link",
  "https://*.albedo.link",
  "https://lobstr.co",
  "https://*.lobstr.co",
  "https://hanawallet.io",
  "https://*.hanawallet.io",
  "https://stellar.creit.tech",
  "wss://*.walletconnect.org",
  "wss://*.walletconnect.com",
];

const connectOrigins = [
  "'self'",
  "https://soroban-testnet.stellar.org",
  "https://horizon-testnet.stellar.org",
  "https://*.stellar.org",
  ...walletOrigins,
  "https://*.sentry.io",
  "https://vitals.vercel-insights.com",
  "ws://localhost:*",
  "wss://localhost:*",
];

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: http://localhost:*",
  "font-src 'self' data:",
  `connect-src ${connectOrigins.join(" ")}`,
  `frame-src 'self' ${walletOrigins.join(" ")}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const baseConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: buildSecurityHeaders(),
      },
    ];
  },
};

// Opt-in bundle report: `npm run analyze` sets ANALYZE=true. Normal builds are unaffected.
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });
const nextConfig = withBundleAnalyzer(baseConfig);

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
