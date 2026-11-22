import type { MetadataRoute } from "next";

/**
 * Robots exclusion configuration.
 *
 * Decision regarding /pay/*:
 * Payment routes (/pay/[id]) contain specific client-freelancer invoice transactions,
 * wallet addresses, settlement amounts, and memo descriptions. They are intentionally
 * disallowed from search engine indexing to protect user privacy and avoid indexing
 * transient or unfinalized invoices.
 *
 * API endpoints (/api/*) are internal backend routes (faucet, feedback) and are also
 * excluded from crawling.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://pay-loop-neon.vercel.app";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/pay/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
