# PayLoop Web

Next.js (App Router) frontend for PayLoop — invoice foreign clients in USDC on
Stellar, cash out in Naira.

## Stack

- Next.js 15 + React 19 + TypeScript
- Tailwind CSS
- `@stellar/stellar-sdk` + `@stellar/freighter-api` for on-chain calls
- Vercel Analytics + Sentry for monitoring

## Local development

```bash
cp .env.example .env.local   # optional: testnet defaults are baked in
npm install
npm run dev                  # http://localhost:3000
```

The public contract/token addresses default to the live testnet deployment, so
the app runs against the real contract with no config. Override via `.env.local`
to point at a different deployment. The faucet button needs
`USDC_ISSUER_SECRET` set server-side.

You'll need the [Freighter](https://freighter.app) browser extension set to
**Testnet**.

## Environment variables

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_CONTRACT_ID` | public | Invoice contract address |
| `NEXT_PUBLIC_TOKEN_ID` | public | Test USDC Stellar Asset Contract |
| `NEXT_PUBLIC_TOKEN_DECIMALS` | public | Token decimals (7) |
| `NEXT_PUBLIC_RPC_URL` | public | Soroban RPC endpoint |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | public | Network passphrase |
| `USDC_ISSUER_SECRET` | **server only** | Issuer secret key for the test-USDC faucet. Never prefix with `NEXT_PUBLIC`. |
| `FEEDBACK_WEBHOOK_URL` | **server only** | Optional. Webhook (Slack/Discord/Zapier) that `/api/feedback` forwards submissions to. |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | mixed | Optional monitoring; build works without them |

Testnet defaults for the public vars are baked into `.env.example`.

## Routes

- `/` — landing page
- `/create` — freelancer creates an invoice (signs one tx)
- `/dashboard` — freelancer's invoices, balances, test-USDC faucet
- `/pay/[id]` — client-facing payment page; funds the invoice in one click
- `/withdraw` — mocked USDC→Naira off-ramp
- `/activity` — public on-chain feed of every invoice + usage stats
- `/api/faucet` — server route that mints test USDC (holds the issuer key)
- `/api/feedback` — collects user feedback, forwards to an optional webhook

## The faucet

`/api/faucet` mints test USDC to a wallet by calling `mint` on the SAC as the
asset issuer. The issuer secret stays server-side. In production this route
would be removed — it exists only so demo users can get testnet balances.

## The Naira off-ramp is mocked

`/withdraw` simulates a licensed anchor (SEP-24) end to end: it validates the
amount against your balance, shows the NGN conversion, and returns a reference.
**No real bank transfer happens and no on-chain funds move.** See
[`../docs/ANCHOR.md`](../docs/ANCHOR.md) for how this would connect to a real
anchor.

## Deploy

Configured for Vercel. Set the env vars in the Vercel project settings, then:

```bash
vercel --prod
```
