# Local Stellar Quickstart development (abdulrcrtw-102)

Standalone guide for running PayLoop against a local Stellar Quickstart network. It does not link itself from `README.md`, `CONTRIBUTING.md`, or `contracts/DEPLOYMENT.md`.

## Why use a local network

A local network gives deterministic accounts, fast ledger closes, no shared testnet rate limits, and the ability to reset chain state without waiting for testnet resets.

## 1. Start Quickstart

Prerequisites: Docker, Stellar CLI v27+, Node 22.x.

```bash
docker run --rm -d -p 8000:8000 --name payloop-quickstart stellar/quickstart:latest --standalone --enable-soroban-rpc
curl http://localhost:8000/health
```

The standalone network passphrase is:

```text
Standalone Network ; February 2017
```

## 2. Configure the Stellar CLI

```bash
stellar network add local \
  --rpc-url http://localhost:8000/soroban/rpc \
  --network-passphrase "Standalone Network ; February 2017"

stellar keys generate local-deployer --network local --fund
stellar keys generate local-usdc-issuer --network local --fund
stellar keys address local-deployer
stellar keys address local-usdc-issuer
```

## 3. Deploy the token and contract

```bash
cd contracts
stellar contract build

stellar contract asset deploy \
  --asset USDC:$(stellar keys address local-usdc-issuer) \
  --source local-deployer \
  --network local

stellar contract deploy \
  --wasm target/wasm32v1-none/release/payloop_invoice.wasm \
  --source local-deployer \
  --network local

stellar contract invoke \
  --id CONTRACT_ID \
  --source local-deployer \
  --network local \
  -- initialize \
  --admin $(stellar keys address local-deployer) \
  --payment_token TOKEN_ID
```

Replace `CONTRACT_ID` and `TOKEN_ID` with the addresses printed by the deploy commands.

## 4. Configure the web app

Create `web/.env.local` with:

```ini
NEXT_PUBLIC_NETWORK=STANDALONE
NEXT_PUBLIC_RPC_URL=http://localhost:8000/soroban/rpc
NEXT_PUBLIC_NETWORK_PASSPHRASE=Standalone Network ; February 2017
NEXT_PUBLIC_CONTRACT_ID=CONTRACT_ID
NEXT_PUBLIC_TOKEN_ID=TOKEN_ID
USDC_ISSUER_SECRET=S_LOCAL_ISSUER_SECRET
```

Then start the app:

```bash
cd web
npm install
npm run dev
```

## 5. Fund a test account

```bash
stellar keys generate local-freelancer --network local --fund
stellar keys address local-freelancer
```

Open the app, connect Freighter with the funded account, switch Freighter to the local network, and create an invoice.

## 6. Smoke test the flow

1. Connect the freelancer wallet.
2. Enable the test USDC trustline in the app.
3. Create an invoice for a client address.
4. Open the `/pay/[id]` link with the client wallet.
5. Fund the invoice and confirm the activity feed updates.

## Known limitations

- The local faucet route only accepts the shared testnet passphrase, so use `stellar keys ... --fund` or the issuer CLI command for local accounts.
- Freighter must be configured with the local network; an account connected on testnet will not sign local transactions.
- Local ledgers are ephemeral unless Quickstart storage is persisted; resetting the container resets all invoices and balances.
- The off-ramp remains mocked; there is no local anchor or real fiat settlement.
- Browser CORS and HTTP RPC access may require a local proxy in hardened browser configurations.
