import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCspDirectives,
  buildSecurityHeaders,
  buildStructuralEnforcingCsp,
  extractOrigin,
} from "../security-headers.mjs";
import nextConfig from "../../next.config.mjs";

function toHeaderMap(headers) {
  return Object.fromEntries(headers.map((h) => [h.key, h.value]));
}

function parseDirectives(csp) {
  return Object.fromEntries(
    csp.split(";").map((part) => {
      const tokens = part.trim().split(/\s+/);
      return [tokens[0], tokens.slice(1)];
    }),
  );
}

test("extractOrigin parses valid URLs and safely ignores invalid ones", () => {
  assert.equal(
    extractOrigin("https://soroban-testnet.stellar.org/rpc"),
    "https://soroban-testnet.stellar.org",
  );
  assert.equal(
    extractOrigin("  https://publicKey@o123.ingest.us.sentry.io/456  "),
    "https://o123.ingest.us.sentry.io",
  );
  assert.equal(extractOrigin("http://localhost:8000/soroban/rpc"), "http://localhost:8000");
  assert.equal(extractOrigin("not-a-url"), null);
  assert.equal(extractOrigin(""), null);
  assert.equal(extractOrigin(undefined), null);
});

test("includes all securityheaders.com-graded headers in default Report-Only rollout", () => {
  const map = toHeaderMap(buildSecurityHeaders({ NODE_ENV: "production" }));

  const required = [
    "Strict-Transport-Security",
    "Content-Security-Policy",
    "Content-Security-Policy-Report-Only",
    "X-Frame-Options",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Permissions-Policy",
  ];
  for (const key of required) {
    assert.ok(map[key] && map[key].length > 0, `Missing header: ${key}`);
  }

  assert.equal(map["X-Frame-Options"], "DENY");
  assert.equal(map["X-Content-Type-Options"], "nosniff");
  assert.equal(map["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.match(map["Strict-Transport-Security"], /max-age=63072000/);

  assert.equal(map["Content-Security-Policy"], buildStructuralEnforcingCsp());
  const structural = parseDirectives(map["Content-Security-Policy"]);
  assert.deepEqual(structural["frame-ancestors"], ["'none'"]);
  assert.deepEqual(structural["base-uri"], ["'self'"]);
  assert.deepEqual(structural["form-action"], ["'self'"]);
  assert.deepEqual(structural["object-src"], ["'none'"]);
});

test("CSP_ENFORCE=true promotes full CSP and omits Report-Only header", () => {
  const env = { NODE_ENV: "production", CSP_ENFORCE: "true" };
  const map = toHeaderMap(buildSecurityHeaders(env));

  assert.equal(map["Content-Security-Policy"], buildCspDirectives(env));
  assert.equal(map["Content-Security-Policy-Report-Only"], undefined);
});

test("allows Soroban RPC, Horizon, Sentry, and Vercel Analytics origins", () => {
  const directives = parseDirectives(buildCspDirectives({ NODE_ENV: "production" }));

  assert.ok(directives["connect-src"].includes("'self'"));
  assert.ok(
    directives["connect-src"].includes("https://soroban-testnet.stellar.org"),
  );
  assert.ok(
    directives["connect-src"].includes("https://horizon-testnet.stellar.org"),
  );
  assert.ok(directives["connect-src"].includes("https://*.ingest.sentry.io"));
  assert.ok(directives["connect-src"].includes("https://*.ingest.us.sentry.io"));
  assert.ok(directives["connect-src"].includes("https://*.ingest.de.sentry.io"));
  assert.ok(directives["connect-src"].includes("https://va.vercel-scripts.com"));
  assert.ok(
    directives["connect-src"].includes("https://vitals.vercel-insights.com"),
  );

  assert.ok(directives["script-src"].includes("https://va.vercel-scripts.com"));
  assert.ok(directives["worker-src"].includes("blob:"));
});

test("dynamically adds custom RPC, Horizon, and Sentry DSN origins without throwing on bad URLs", () => {
  const directives = parseDirectives(
    buildCspDirectives({
      NODE_ENV: "production",
      NEXT_PUBLIC_RPC_URL: "https://rpc.custom.example/soroban",
      NEXT_PUBLIC_HORIZON_URL: "https://horizon.custom.example",
      NEXT_PUBLIC_SENTRY_DSN: "https://abc@o99.ingest.sentry.io/42",
    }),
  );

  assert.ok(directives["connect-src"].includes("https://rpc.custom.example"));
  assert.ok(directives["connect-src"].includes("https://horizon.custom.example"));
  assert.ok(directives["connect-src"].includes("https://o99.ingest.sentry.io"));

  assert.doesNotThrow(() =>
    buildCspDirectives({
      NODE_ENV: "production",
      NEXT_PUBLIC_RPC_URL: "invalid-url",
      NEXT_PUBLIC_HORIZON_URL: "://bad",
      NEXT_PUBLIC_SENTRY_DSN: "not a dsn",
    }),
  );
});

test("excludes dev-only unsafe-eval and websocket tokens in production", () => {
  const prod = parseDirectives(buildCspDirectives({ NODE_ENV: "production" }));
  assert.ok(!prod["script-src"].includes("'unsafe-eval'"));
  assert.ok(!prod["connect-src"].includes("ws:"));
  assert.ok(!prod["connect-src"].includes("wss:"));

  const dev = parseDirectives(buildCspDirectives({ NODE_ENV: "development" }));
  assert.ok(dev["script-src"].includes("'unsafe-eval'"));
  assert.ok(dev["connect-src"].includes("ws:"));
  assert.ok(dev["connect-src"].includes("wss:"));
});

test("includes upgrade-insecure-requests only on HTTPS deployments", () => {
  const localHttp = parseDirectives(
    buildCspDirectives({
      NODE_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    }),
  );
  assert.equal(localHttp["upgrade-insecure-requests"], undefined);

  const vercel = parseDirectives(
    buildCspDirectives({ NODE_ENV: "production", VERCEL: "1" }),
  );
  assert.ok("upgrade-insecure-requests" in vercel);

  const httpsSite = parseDirectives(
    buildCspDirectives({
      NODE_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "https://payloop.example",
    }),
  );
  assert.ok("upgrade-insecure-requests" in httpsSite);
});

test("Permissions-Policy does not block clipboard-write", () => {
  const map = toHeaderMap(buildSecurityHeaders({ NODE_ENV: "production" }));
  assert.doesNotMatch(map["Permissions-Policy"], /clipboard-write/);
});

test("next.config.mjs applies security headers to all routes via /(.*)", async () => {
  assert.equal(typeof nextConfig.headers, "function");
  const rules = await nextConfig.headers();
  assert.equal(rules.length, 1);
  assert.equal(rules[0].source, "/(.*)");
  const map = toHeaderMap(rules[0].headers);
  assert.equal(map["X-Frame-Options"], "DENY");
  assert.equal(map["X-Content-Type-Options"], "nosniff");
  assert.ok(map["Content-Security-Policy"]);
});
