# Security Headers & Content Security Policy (CSP)

This document outlines the security headers configured in `web/next.config.mjs` for PayLoop, the rationale behind each header, the allowed origins, and instructions for future integrations.

---

## 1. Overview of Security Headers

PayLoop serves financial transactions, invoices, and payment authorizations on the Stellar network. Strong security headers protect against clickjacking, cross-site scripting (XSS), MIME-sniffing, and data exfiltration.

| Header | Configured Value | Purpose |
| :--- | :--- | :--- |
| **`Content-Security-Policy`** | *See Directive Breakdown Below* | Restricts where scripts, styles, images, and network connections originate, preventing malicious script injection. |
| **`X-Frame-Options`** | `DENY` | Prevents PayLoop from being loaded in `<frame>`, `<iframe>`, `<embed>`, or `<object>` elements, eliminating clickjacking attacks. |
| **`X-Content-Type-Options`** | `nosniff` | Disables MIME type sniffing, preventing browsers from executing non-executable MIME types as code. |
| **`Referrer-Policy`** | `strict-origin-when-cross-origin` | Protects privacy by stripping query params and paths on cross-origin requests while retaining origin for HTTPS. |
| **`Permissions-Policy`** | `camera=(), microphone=(), geolocation=(), browsing-topics=()` | Disables unused browser hardware and tracking APIs across all origins. |
| **`Strict-Transport-Security`** | `max-age=63072000; includeSubDomains; preload` | Enforces HTTPS communication for two years across all subdomains and permits HSTS preload list submission. |
| **`X-DNS-Prefetch-Control`** | `on` | Enables pre-resolving hostnames for external services to optimize latency. |

---

## 2. Allowed CSP Origins & Services

| Directive | Allowed Sources / Domains | Justification |
| :--- | :--- | :--- |
| **`default-src`** | `'self'` | Secure default fallback restricted to PayLoop's own domain. |
| **`script-src`** | `'self'`, `'unsafe-inline'`, `'unsafe-eval'`, `https://va.vercel-scripts.com` | Next.js hydration, theme provider scripts, dynamic components, and Vercel Analytics tracking. |
| **`style-src`** | `'self'`, `'unsafe-inline'` | Tailwind CSS styles, CSS variables, and dynamically injected style tags. |
| **`img-src`** | `'self'`, `blob:`, `data:`, `https://*.stellar.org`, `https://stellar.expert` | QR codes, local data URIs, token icons, and network badges from Stellar Foundation / Stellar Expert. |
| **`font-src`** | `'self'`, `data:` | Local web fonts and embedded icon fonts. |
| **`connect-src`** | `'self'`, `https://*.stellar.org`, `https://soroban-testnet.stellar.org`, `https://horizon-testnet.stellar.org`, `https://stellar.expert`, `https://*.sentry.io`, `https://*.ingest.sentry.io`, `https://*.ingest.us.sentry.io`, `https://vitals.vercel-insights.com`, `https://va.vercel-scripts.com` | Stellar Soroban RPC requests, Horizon queries, Sentry error monitoring, Vercel Web Vitals telemetry, and block explorer links. *(Development also permits `ws:`, `localhost`, and `127.0.0.1` for Fast Refresh).* |
| **`frame-ancestors`** | `'none'` | Mirrors `X-Frame-Options: DENY` for modern browsers. |
| **`form-action`** | `'self'` | Forms cannot post data to untrusted third-party endpoints. |
| **`base-uri`** | `'self'` | Prevents `<base>` tag injection attacks. |
| **`object-src`** | `'none'` | Blocks legacy plugins (Flash, Java, Silverlight). |

---

## 3. Safe Rollout / Report-Only Mode

To verify CSP compliance before strict enforcement:

1. Set the environment variable:
   ```env
   CSP_REPORT_ONLY=true
   ```
2. When enabled, PayLoop sends **`Content-Security-Policy-Report-Only`** instead of `Content-Security-Policy`. Browsers will report violations to developer tools without blocking valid user operations.
3. Once verified, leave unset or `false` to enforce the policy with an A/A+ security rating.

---

## 4. Wallet Integrations & Future Expansion

* **Freighter Wallet:** Injected into `window.freighterApi`. Communication is handled in-process via DOM window messaging and does not require external script origins.
* **Issue #33 (Live Anchor Integrations):** If interactive SEP-24 / SEP-6 off-ramp anchors or webview popups are integrated, add the anchor domain (e.g. `https://*.anchor-domain.com`) to `connect-src` and `frame-src` in `buildCsp()`.
* **Issue #34 (Additional Wallets):** If WalletConnect or web-based Stellar wallets (e.g. Albedo, Hana, xBull) are added, add `https://*.walletconnect.com`, `wss://*.walletconnect.org`, and `https://albedo.link` to `connect-src` and `script-src` as required.
