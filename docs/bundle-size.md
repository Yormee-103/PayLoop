# Bundle size baseline

Run the opt-in analyzer from `web/`:

    npm run analyze

This runs `next build` with `ANALYZE=true` (via `@next/bundle-analyzer`) and writes
interactive reports to `web/.next/analyze/client.html`, `nodejs.html` and `edge.html`.
Normal `npm run build` is unchanged.

## Baseline (Next.js 15.5.20, `next build`)

| Route | Page JS | First Load JS |
| --- | --- | --- |
| / | 168 B | 106 kB |
| /help | 168 B | 106 kB |
| /pitch | 2.71 kB | 105 kB |
| /activity | 4.51 kB | 204 kB |
| /create | 3.64 kB | 206 kB |
| /dashboard | 5.44 kB | 207 kB |
| /history | 4.5 kB | 206 kB |
| /pay/[id] | 4.5 kB | 206 kB |
| /statement | 4.64 kB | 204 kB |
| /withdraw | 3.31 kB | 199 kB |

Shared by all routes: 102 kB.

## Finding

Routes that import `lib/contract.ts` pull in `@stellar/stellar-sdk`, which accounts
for roughly 100 kB of extra First Load JS compared with the routes that do not
touch it (/, /help, /pitch at about 105 kB versus about 200 to 207 kB).

Every contract route reads from the contract as soon as it mounts (invoice list,
invoice lookup, balances), so the SDK is needed for the first meaningful render.
Moving it behind `import()` would only delay the same download until after
hydration and add a loading waterfall, with no reduction in bytes the user pays
for. The routes that do not need the SDK already do not load it.

Conclusion: no lazy-loading change is justified by the data, so before and after
sizes are identical. This is the "no change needed, with data" outcome allowed by
the issue.
