import { test, describe } from "node:test";
import assert from "node:assert/strict";
import nextConfig, { buildCsp, getSecurityHeaders } from "../next.config.mjs";

describe("Security Headers Configuration", () => {
  test("nextConfig defines headers() returning /:path* wildcard match", async () => {
    assert.equal(typeof nextConfig.headers, "function");
    const headersList = await nextConfig.headers();
    assert.ok(Array.isArray(headersList));
    assert.equal(headersList.length, 1);
    assert.equal(headersList[0].source, "/:path*");
    assert.ok(Array.isArray(headersList[0].headers));
  });

  test("returns all required security headers", () => {
    const headers = getSecurityHeaders();
    const map = new Map(headers.map((h) => [h.key, h.value]));

    assert.ok(
      map.has("Content-Security-Policy") ||
        map.has("Content-Security-Policy-Report-Only"),
      "CSP header must be present"
    );
    assert.equal(map.get("X-Frame-Options"), "DENY");
    assert.equal(map.get("X-Content-Type-Options"), "nosniff");
    assert.equal(
      map.get("Referrer-Policy"),
      "strict-origin-when-cross-origin"
    );
    assert.equal(
      map.get("Permissions-Policy"),
      "camera=(), microphone=(), geolocation=(), browsing-topics=()"
    );
    assert.equal(
      map.get("Strict-Transport-Security"),
      "max-age=63072000; includeSubDomains; preload"
    );
    assert.equal(map.get("X-DNS-Prefetch-Control"), "on");
  });

  test("buildCsp includes required origins for Soroban RPC, Horizon, Sentry, Analytics, and Explorer", () => {
    const csp = buildCsp();

    // Default & Fallbacks
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /base-uri 'self'/);
    assert.match(csp, /form-action 'self'/);

    // Scripts
    assert.match(csp, /script-src [^;]*'self'/);
    assert.match(csp, /script-src [^;]*'unsafe-inline'/);
    assert.match(csp, /script-src [^;]*'unsafe-eval'/);
    assert.match(csp, /script-src [^;]*https:\/\/va\.vercel-scripts\.com/);

    // Styles
    assert.match(csp, /style-src [^;]*'self'/);
    assert.match(csp, /style-src [^;]*'unsafe-inline'/);

    // Images
    assert.match(csp, /img-src [^;]*'self'/);
    assert.match(csp, /img-src [^;]*blob:/);
    assert.match(csp, /img-src [^;]*data:/);
    assert.match(csp, /img-src [^;]*https:\/\/\*\.stellar\.org/);
    assert.match(csp, /img-src [^;]*https:\/\/stellar\.expert/);

    // Connect (RPC, Horizon, Sentry, Vercel)
    assert.match(csp, /connect-src [^;]*'self'/);
    assert.match(csp, /connect-src [^;]*https:\/\/\*\.stellar\.org/);
    assert.match(csp, /connect-src [^;]*https:\/\/soroban-testnet\.stellar\.org/);
    assert.match(csp, /connect-src [^;]*https:\/\/horizon-testnet\.stellar\.org/);
    assert.match(csp, /connect-src [^;]*https:\/\/stellar\.expert/);
    assert.match(csp, /connect-src [^;]*https:\/\/\*\.sentry\.io/);
    assert.match(csp, /connect-src [^;]*https:\/\/\*\.ingest\.sentry\.io/);
    assert.match(csp, /connect-src [^;]*https:\/\/vitals\.vercel-insights\.com/);
    assert.match(csp, /connect-src [^;]*https:\/\/va\.vercel-scripts\.com/);
  });

  test("CSP_REPORT_ONLY=true sets Content-Security-Policy-Report-Only", () => {
    const prev = process.env.CSP_REPORT_ONLY;
    try {
      process.env.CSP_REPORT_ONLY = "true";
      const headers = getSecurityHeaders();
      const cspHeader = headers.find(
        (h) => h.key === "Content-Security-Policy-Report-Only"
      );
      assert.ok(cspHeader, "Should produce report-only CSP header");
      assert.ok(
        !headers.some((h) => h.key === "Content-Security-Policy"),
        "Should not produce enforced CSP header when report-only is enabled"
      );
    } finally {
      if (prev === undefined) {
        delete process.env.CSP_REPORT_ONLY;
      } else {
        process.env.CSP_REPORT_ONLY = prev;
      }
    }
  });
});
