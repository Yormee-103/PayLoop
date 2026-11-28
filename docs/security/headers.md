# HTTP Security Headers & Content Security Policy

PayLoop sets HTTP security headers across all Next.js routes (`/(.*)`) via [`web/next.config.mjs`](../../web/next.config.mjs) and [`web/lib/security-headers.mjs`](../../web/lib/security-headers.mjs).

Because PayLoop prompts users to connect a wallet and sign Stellar Soroban transactions, these headers protect against clickjacking, cross-site scripting (XSS), MIME-type sniffing, and unauthorized third-party script or network origins.

## Response Headers

| Header | Value | Threat Mitigated |
| --- | --- | --- |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Downgrade and protocol-stripping attacks over HTTPS |
| `X-Frame-Options` | `DENY` | Legacy-browser clickjacking via `<iframe>` embedding |
| `X-Content-Type-Options` | `nosniff` | MIME confusion / script execution from non-script responses |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Leaking invoice URLs or paths in `Referer` headers to external links |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()` | Unrequested access to sensitive browser hardware/APIs (`clipboard-write` remains allowed for copy buttons) |
| `Content-Security-Policy` | Structural policy by default; full policy when `CSP_ENFORCE=true` | Clickjacking (`frame-ancestors 'none'`), base-tag hijacking, external form targets, plugin objects, and (when enforced) injected scripts/connections |
| `Content-Security-Policy-Report-Only` | Full CSP during default rollout (omitted when `CSP_ENFORCE=true`) | Surfaces unexpected script, worker, style, or network origins in DevTools without breaking live users |

## Allowed CSP Directives & Origins

| Directive | Allowed Sources | Rationale |
| --- | --- | --- |
| `default-src` | `'self'` | Baseline deny-by-default for any directive not explicitly listed |
| `base-uri` | `'self'` | Prevents injected `<base>` tags from rewriting relative script URLs |
| `form-action` | `'self'` | Prevents form submissions to attacker-controlled origins |
| `frame-ancestors` | `'none'` | Blocks embedding PayLoop in any `<iframe>`, `<frame>`, or `<object>` |
| `frame-src` | `'none'` | PayLoop does not embed third-party iframes |
| `object-src` | `'none'` | Disables Flash, Java, and legacy plugin content |
| `font-src` | `'self'` | PayLoop uses system font stacks (`globals.css`), with no external font CDNs |
| `img-src` | `'self' data: blob:` | App icons, generated OpenGraph images, and local browser blob/data previews |
| `style-src` | `'self' 'unsafe-inline'` | Tailwind CSS bundle plus React inline `style={{ ... }}` attributes (e.g., progress charts and error fallbacks) |
| `script-src` | `'self' 'unsafe-inline' https://va.vercel-scripts.com` (+ `'unsafe-eval'` in non-production) | Next.js 15 App Router inline hydration scripts and Vercel Analytics script delivery (`'unsafe-eval'` is restricted to local development) |
| `worker-src` | `'self' blob:` | Sentry Session Replay compression worker instantiated from a `blob:` URL |
| `connect-src` | `'self'`, configured RPC origin, configured Horizon origin, configured Sentry DSN origin, `https://*.ingest.sentry.io`, `https://*.ingest.us.sentry.io`, `https://*.ingest.de.sentry.io`, `https://va.vercel-scripts.com`, `https://vitals.vercel-insights.com` (+ `ws: wss:` in non-production) | Soroban RPC (`NEXT_PUBLIC_RPC_URL`, defaults to `https://soroban-testnet.stellar.org`), Horizon (`NEXT_PUBLIC_HORIZON_URL`, defaults to `https://horizon-testnet.stellar.org`), Sentry error/replay ingestion (`NEXT_PUBLIC_SENTRY_DSN`), Vercel Analytics beacons, and same-origin `/api/faucet` & `/api/feedback` |
| `upgrade-insecure-requests` | Included only when `VERCEL=1` or `NEXT_PUBLIC_SITE_URL` starts with `https://` | Upgrades mixed-content requests in HTTPS deployments without breaking local `http://localhost:3000` |

### Notes on Wallets & Same-Origin Flows

- **Freighter (`@stellar/freighter-api`)** communicates with the browser extension via injected content scripts / `window.postMessage`, so it requires no external `connect-src` or `frame-src` origin.
- **Built-in Faucet & Feedback** call same-origin Next.js API routes (`/api/faucet` and `/api/feedback`), covered by `'self'`.
- **CSV Export** creates client-side `blob:` object URLs (`URL.createObjectURL`) for `<a download>`, which does not violate `connect-src` or `script-src`.

## Rollout Strategy (Report-Only -> Enforcing)

1. **Report-Only rollout (default, `CSP_ENFORCE` unset or `false`):**
   - `Content-Security-Policy-Report-Only` carries the complete directive set so browser DevTools logs any violations across browsers/environments without blocking transactions.
   - `Content-Security-Policy` enforces the low-risk structural subset (`frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`) so clickjacking and object/form hijacking protection is active immediately and header scanners (such as `securityheaders.com`) score **A** or better.
2. **Full enforcement (`CSP_ENFORCE=true`):**
   - Once normal sessions (connect Freighter, create invoice, pay invoice, faucet, analytics, and error reporting) show zero CSP violations in DevTools, set `CSP_ENFORCE=true` in the deployment environment.
   - This promotes the full policy to `Content-Security-Policy` and omits `Content-Security-Policy-Report-Only`.

## Updating Origins for Future Dependencies

When adding new external integrations, update [`web/lib/security-headers.mjs`](../../web/lib/security-headers.mjs) and its tests in [`web/lib/__tests__/security-headers.test.mjs`](../../web/lib/__tests__/security-headers.test.mjs):

- **Live SEP-24 / Anchor Integration (Issue #33):**
  - Add the anchor's `TRANSFER_SERVER` / SEP-24 API origin (and any `stellar.toml` host if fetched from the browser) to `connect-src`.
  - If the SEP-24 interactive KYC/off-ramp URL is rendered inside an `<iframe>` rather than opened in a popup window, add the anchor interactive origin to `frame-src` (replacing `'none'`).
- **Additional Wallets (Issue #34):**
  - Browser-extension wallets (like Freighter, xBull, or Albedo extension) typically work over extension messaging without extra origins, whereas **hosted web wallets** or **WalletConnect** require adding their popup/iframe URLs (`frame-src` / `connect-src`) and WebSocket relay origins (e.g., `wss://relay.walletconnect.com`, `wss://relay.walletconnect.org`) to `connect-src`.
