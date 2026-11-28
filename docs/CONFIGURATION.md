# PayLoop Configuration Guide

This document explains how to configure PayLoop for different deployments and environments, including network settings, contract addresses, tokens, and optional features.

## Configuration Overview

PayLoop uses environment variables for configuration, stored in `web/.env.local` for local development and set in the deployment platform (e.g., Vercel) for production.

**Key principle:** All configuration values are **public** and safe to include in the browser bundle. They are prefixed with `NEXT_PUBLIC_` to signal this. Secrets (faucet issuer key, webhook URLs) are **not** included in this guide — see the deployment documentation for sensitive config.

### Configuration Source

The main config object lives in `web/lib/config.ts`:

```typescript
export const config = {
  network: "TESTNET" | "PUBLIC",
  networkPassphrase: string,
  rpcUrl: string,
  horizonUrl: string,
  contractId: string,
  readSource: string,
  tokenId: string,
  tokenIssuer: string,
  tokenDecimals: number,
  tokenSymbol: string,
  tokens: TokenConfig[],
} as const;
```

All values are `const`, meaning they are known at build time and can be optimized by the compiler.

## Environment Variables

Environment variables are read from `.env.local` during development and from the deployment platform during production.

### Network Configuration

#### `NEXT_PUBLIC_NETWORK`
**Type:** `"TESTNET"` | `"PUBLIC"`  
**Default:** `"TESTNET"`  
**Description:** Stellar network to connect to.

```bash
NEXT_PUBLIC_NETWORK=TESTNET   # Stellar testnet (default)
NEXT_PUBLIC_NETWORK=PUBLIC    # Stellar public network (mainnet)
```

**Effect:**
- Changes the Stellar Expert explorer base URL (`stellar.expert/explorer/{network}/...`)
- Used for display and link generation only; the RPC and Horizon URLs determine which network is actually used

#### `NEXT_PUBLIC_NETWORK_PASSPHRASE`
**Type:** `string`  
**Default:** `"Test SDF Network ; September 2015"` (testnet)  
**Description:** Network passphrase for transaction signing.

```bash
# Testnet (default)
NEXT_PUBLIC_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

# Mainnet (if deploying to Stellar public network)
NEXT_PUBLIC_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
```

**Where it matters:**
- Freighter wallet uses this to sign transactions correctly for the target network
- Mismatched passphrases cause wallet transaction signing to fail
- Must match the RPC URL's network

### RPC and API Endpoints

#### `NEXT_PUBLIC_RPC_URL`
**Type:** `string` (URL)  
**Default:** `"https://soroban-testnet.stellar.org"`  
**Description:** Soroban RPC endpoint for contract calls.

```bash
# Testnet
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org

# Public network (if available)
NEXT_PUBLIC_RPC_URL=https://soroban-mainnet.stellar.org
```

**Used for:**
- Submitting contract transactions
- Calling contract read methods
- Simulating transactions

#### `NEXT_PUBLIC_HORIZON_URL`
**Type:** `string` (URL)  
**Default:** `"https://horizon-testnet.stellar.org"`  
**Description:** Horizon API endpoint for account data.

```bash
# Testnet
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org

# Mainnet
NEXT_PUBLIC_HORIZON_URL=https://horizon.stellar.org
```

**Used for:**
- Fetching account balances and sequence numbers
- Checking account trustlines
- Building transaction envelopes

### Contract and Token Configuration

#### `NEXT_PUBLIC_CONTRACT_ID`
**Type:** `string` (Stellar contract ID)  
**Default:** `"CAQVSBNVL7OI66IDTYCR7XL4VJKMSOYGBW5D6SWLTWTINTCQO2OGCSXS"` (PayLoop testnet)  
**Description:** The deployed PayLoop invoice contract address.

```bash
# PayLoop testnet (default)
NEXT_PUBLIC_CONTRACT_ID=CAQVSBNVL7OI66IDTYCR7XL4VJKMSOYGBW5D6SWLTWTINTCQO2OGCSXS

# Custom deployment
NEXT_PUBLIC_CONTRACT_ID=CXYZ1234567890ABCDEF1234567890ABCDEF1234567
```

**How to find it:**
1. Deploy the contract with `stellar contract deploy` (see `contracts/DEPLOYMENT.md`)
2. The CLI output includes the contract ID
3. Store it in Vercel project settings or `.env.local` for local testing

#### `NEXT_PUBLIC_READ_SOURCE`
**Type:** `string` (Stellar account address)  
**Default:** `"GBTDIHYJA4OPTDBDRKH5A5PHBSH7QVAEY46V27DCB24SXNRXIQNHSNUM"`  
**Description:** Account used as the simulation source for contract read calls.

```bash
# Default (never signs anything, can be any funded account)
NEXT_PUBLIC_READ_SOURCE=GBTDIHYJA4OPTDBDRKH5A5PHBSH7QVAEY46V27DCB24SXNRXIQNHSNUM

# Custom account for your deployment
NEXT_PUBLIC_READ_SOURCE=GACCOUNT1234567890ABCDEF1234567890ABCDEF1234
```

**Why it exists:**
- Soroban contract read calls must specify a "source" account for simulation
- This account never signs transactions; it is only used as a simulation context
- It must have a minimum balance to submit read transactions (the testnet account above is maintained for this purpose)
- For production, any funded account can be used

**Note:** This is **not** a security boundary. It is never used to authorize writes or access control.

### Token Configuration

#### `NEXT_PUBLIC_TOKEN_SYMBOL`
**Type:** `string`  
**Default:** `"USDC"`  
**Description:** Display symbol for the default payment token.

```bash
NEXT_PUBLIC_TOKEN_SYMBOL=USDC     # (default)
NEXT_PUBLIC_TOKEN_SYMBOL=EURC     # for Euro stablecoin
```

**Used for:**
- UI display ("Send 100 USDC")
- Invoice amount display
- Fallback when contract token metadata is unavailable

#### `NEXT_PUBLIC_TOKEN_DECIMALS`
**Type:** `number`  
**Default:** `"7"`  
**Description:** Number of decimal places for the default token (stroops precision).

```bash
NEXT_PUBLIC_TOKEN_DECIMALS=7      # USDC (default)
NEXT_PUBLIC_TOKEN_DECIMALS=6      # mainnet USDC has 6 decimals
NEXT_PUBLIC_TOKEN_DECIMALS=8      # for 8-decimal tokens
```

**Used by:**
- Format utilities (`toBaseUnits`, `fromBaseUnits`)
- Amount conversion and display

#### `NEXT_PUBLIC_TOKENS`
**Type:** `string` (JSON)  
**Default:** (omitted; uses default token only)  
**Description:** Additional payment tokens the contract allows (beyond the default).

The PayLoop contract supports multiple token types. Configure additional tokens as a JSON array:

```bash
# Single additional token
NEXT_PUBLIC_TOKENS='[{"id":"CTOKEN1234...","issuer":"GISSUER1234...","symbol":"EURC","decimals":6}]'

# Multiple tokens
NEXT_PUBLIC_TOKENS='[{"id":"CTOKEN1...","issuer":"GISSUER1...","symbol":"EURC","decimals":6},{"id":"CTOKEN2...","issuer":"GISSUER2...","symbol":"BRL","decimals":8}]'
```

**Token object fields:**
- `id` (required): Stellar contract ID of the token
- `issuer` (required): Stellar account that issued the classic asset
- `symbol` (optional): Display symbol; defaults to `"TOKEN"`
- `decimals` (optional): Token decimals; defaults to `7`

**How it works:**
- The default token (USDC on testnet) is always included
- Additional tokens in `NEXT_PUBLIC_TOKENS` are appended to the list
- When creating an invoice, users can select from all configured tokens
- The app reads authoritative `symbol` and `decimals` from each token contract at runtime (env values are fallbacks)

**Example: Supporting EUR and BRL alongside USDC**

```bash
NEXT_PUBLIC_TOKENS='[
  {
    "id": "CEURC...",
    "issuer": "GEURC_ISSUER...",
    "symbol": "EURC",
    "decimals": 6
  },
  {
    "id": "CBRL...",
    "issuer": "GBRL_ISSUER...",
    "symbol": "BRL",
    "decimals": 8
  }
]'
```

## Configuration Examples

### Testnet Setup (Local Development)

Create `web/.env.local`:

```bash
# Network
NEXT_PUBLIC_NETWORK=TESTNET
NEXT_PUBLIC_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

# Endpoints
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org

# Contract (PayLoop testnet deployment)
NEXT_PUBLIC_CONTRACT_ID=CAQVSBNVL7OI66IDTYCR7XL4VJKMSOYGBW5D6SWLTWTINTCQO2OGCSXS

# Token (test USDC)
NEXT_PUBLIC_TOKEN_SYMBOL=USDC
NEXT_PUBLIC_TOKEN_DECIMALS=7
```

Then:

```bash
cd web
npm install
npm run dev
# Open http://localhost:3000
```

### Mainnet Setup

For deployment to Stellar mainnet, create a `.env.production.local` or set in your deployment platform:

```bash
# Network
NEXT_PUBLIC_NETWORK=PUBLIC
NEXT_PUBLIC_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"

# Endpoints
NEXT_PUBLIC_RPC_URL=https://soroban-mainnet.stellar.org
NEXT_PUBLIC_HORIZON_URL=https://horizon.stellar.org

# Contract (your production deployment)
NEXT_PUBLIC_CONTRACT_ID=CPRODUCTION1234567890ABCDEF...

# Token (mainnet USDC; 6 decimals)
NEXT_PUBLIC_TOKEN_SYMBOL=USDC
NEXT_PUBLIC_TOKEN_DECIMALS=6
```

### Multi-Currency Setup

For a deployment that accepts USDC, EURC, and BRL:

```bash
NEXT_PUBLIC_TOKENS='[
  {
    "id": "CD6TGMLHYQK2LHKQMQNJ7YTFMVHGQZPVL7RQRDCB2JRWW3RBWYQM4Y3",
    "issuer": "GATEMHCCKCY67ZUCKTROYN24ZYT5GK4EQZ5LKG6PHPYELUS4KMSI6EP2",
    "symbol": "EURC",
    "decimals": 6
  },
  {
    "id": "CBRL1234567890ABCDEF1234567890ABCDEF123456789",
    "issuer": "GBRL_ISSUER_ABCDEF",
    "symbol": "BRL",
    "decimals": 8
  }
]'
```

## Configuration at Runtime

The `config` object is built at build time and cannot change without a rebuild. This is intentional:

- ✅ **Builds are deterministic** — same source + env = same bundle
- ✅ **Type-safe** — TypeScript knows all config values statically
- ✅ **Optimizable** — bundler can tree-shake unused code paths
- ❌ **Cannot be changed dynamically** — requires rebuild and redeploy

## Reading Configuration in Code

Always import from `web/lib/config.ts`:

```typescript
import { config, tokens, getTokenConfig } from "@/lib/config";

// Access configuration values
console.log(config.contractId);        // The PayLoop contract
console.log(config.network);           // "TESTNET" or "PUBLIC"
console.log(config.networkPassphrase); // For wallet signing

// Get a specific token's config
const usdc = getTokenConfig(config.tokenId);
console.log(usdc.symbol);       // "USDC"
console.log(usdc.decimals);     // 7

// List all configured tokens
for (const token of config.tokens) {
  console.log(`${token.symbol}: ${token.id}`);
}
```

**Never hardcode addresses or symbols.** Use the config object so changes only need to be made once per deployment.

## Validation

Check that configuration is complete:

```typescript
import { isConfigured } from "@/lib/config";

if (!isConfigured()) {
  throw new Error("Missing NEXT_PUBLIC_CONTRACT_ID or NEXT_PUBLIC_TOKEN_ID");
}
```

This is called at app startup; if config is incomplete, a banner error is shown.

## Deployment to Vercel

1. Push code to GitHub
2. Import repo in Vercel dashboard
3. Set `Root Directory` to `web/`
4. Under Environment Variables, add your `NEXT_PUBLIC_*` values
5. Deploy

Vercel will rebuild the app with the new config values on each deploy.

## Security Headers & CSP

`web/next.config.mjs` applies HTTP security headers (`Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and `Content-Security-Policy`) to all routes via `web/lib/security-headers.mjs`.

- Allowed `connect-src` origins for Soroban RPC, Horizon, and Sentry are derived automatically from `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_HORIZON_URL`, and `NEXT_PUBLIC_SENTRY_DSN`, alongside the default testnet and Vercel Analytics endpoints.
- By default, the full CSP ships in `Content-Security-Policy-Report-Only` alongside an enforcing structural policy (`frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`). Set `CSP_ENFORCE=true` in your deployment environment to enforce the full policy directly.

See [docs/security/headers.md](security/headers.md) for the complete origin inventory and maintenance checklist for future anchor (#33) or wallet (#34) integrations.

## Troubleshooting

### "No contract found" or "Network error"
Check that:
- `NEXT_PUBLIC_CONTRACT_ID` is correct (from your deployment)
- `NEXT_PUBLIC_RPC_URL` and `NEXT_PUBLIC_HORIZON_URL` match the network
- Network passphrase matches the target network
- The contract is actually deployed to that address

### Wallet not connecting
Check that:
- `NEXT_PUBLIC_NETWORK_PASSPHRASE` matches what your wallet expects
- Freighter wallet is set to the correct network
- RPC URL is reachable

### Incorrect token display
Check that:
- `NEXT_PUBLIC_TOKEN_SYMBOL` and `NEXT_PUBLIC_TOKEN_DECIMALS` match the contract
- If using `NEXT_PUBLIC_TOKENS`, ensure token IDs are correct
- Contract token metadata is readable from the RPC URL

## See Also

- **web/.env.example** — Template with all available variables
- **contracts/DEPLOYMENT.md** — Deploying the contract and finding its ID
- **ARCHITECTURE.md** — System design and components
- **TESTING.md** — Configuration for local testing

