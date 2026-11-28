import { withSentryConfig } from "@sentry/nextjs";
import { buildSecurityHeaders } from "./lib/security-headers.mjs";
import bundleAnalyzer from "@next/bundle-analyzer";

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
