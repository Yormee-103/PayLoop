# Contract deployment — Stellar Testnet

This walks through building the PayLoop invoice contract, issuing a **test USDC**
token, deploying, and initializing. Commands assume the `stellar` CLI (v27+).

> The resulting addresses go into `web/.env.local` (see `web/.env.example`) and
> into the root `README.md` deployment table.

## 0. One-time: an identity funded on testnet

```bash
stellar keys generate deployer --network testnet --fund
stellar keys address deployer
```

## 1. Build

```bash
cd contracts
stellar contract build
# -> target/wasm32v1-none/release/payloop_invoice.wasm
```

## 2. Create a test USDC token (Stellar Asset Contract)

For the MVP the payment token is a test USDC asset we issue ourselves so that
onboarded users can actually fund invoices. On testnet:

```bash
# Issuer identity for the asset
stellar keys generate usdc-issuer --network testnet --fund

# Wrap the classic asset USDC:<issuer> as a Soroban token (SAC)
stellar contract asset deploy \
  --asset USDC:$(stellar keys address usdc-issuer) \
  --source deployer \
  --network testnet
# -> prints the token contract address  (TOKEN_ID)
```

Record the SAC address as `TOKEN_ID`.

## 3. Deploy the invoice contract

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/payloop_invoice.wasm \
  --source deployer \
  --network testnet
# -> prints the contract address  (CONTRACT_ID)
```

## 4. Initialize

```bash
stellar contract invoke \
  --id CONTRACT_ID \
  --source deployer \
  --network testnet \
  -- initialize \
  --admin $(stellar keys address deployer) \
  --payment_token TOKEN_ID
```

## 5. Record addresses

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_CONTRACT_ID` | CONTRACT_ID |
| `NEXT_PUBLIC_TOKEN_ID` | TOKEN_ID |
| `NEXT_PUBLIC_NETWORK` | `TESTNET` |
| `NEXT_PUBLIC_RPC_URL` | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` |

## 6. Faucet for onboarded users (mint test USDC)

The app exposes a "Get test USDC" button that calls a backend mint. That backend
uses the `usdc-issuer` key to mint to a user address:

```bash
stellar contract invoke \
  --id TOKEN_ID \
  --source usdc-issuer \
  --network testnet \
  -- mint \
  --to <USER_ADDRESS> \
  --amount 5000000000   # 500 USDC at 7 decimals
```

Set `USDC_ISSUER_SECRET` in the web app's server env for the faucet route.

## Quick smoke test from the CLI

```bash
# create an invoice as a freelancer
stellar contract invoke --id CONTRACT_ID --source deployer --network testnet \
  -- create_invoice \
  --freelancer <FREELANCER_ADDR> --client <CLIENT_ADDR> \
  --amount 2000000000 --description "Landing page copy" --due_date 0

# read it back
stellar contract invoke --id CONTRACT_ID --source deployer --network testnet \
  -- get_invoice --invoice_id 1
```
