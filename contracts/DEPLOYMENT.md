# Contract deployment — Stellar Testnet

This walks through building the PayLoop invoice contract, issuing a **test USDC**
token, and deploying it. Initialization runs atomically with deployment
through the contract constructor, so there is no separate initialize step
and no window where someone else could initialize the fresh instance.
Commands assume the `stellar` CLI (v27+).

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
cargo build --locked --target wasm32v1-none --release
# -> target/wasm32v1-none/release/payloop_invoice.wasm
```

The repository's `rust-toolchain.toml` pins Rust 1.98.1, including the
`wasm32v1-none` target. Keep that toolchain, `Cargo.lock`, and the release
build command unchanged when reproducing a deployment artifact. CI uses this
same toolchain and writes the SHA-256 and source commit to its job summary.

### Verify a source checkout against the deployed contract

From the repository root, build the contract and compare its hash with the
testnet deployment manifest:

```bash
(cd contracts && cargo build --locked --target wasm32v1-none --release)
bash scripts/verify-wasm-hash.sh
```

The script prints both SHA-256 values and exits with status 0 only when they
match. A mismatch means that checkout did not produce the WASM whose hash is
recorded in `deployment.testnet.json`; it does not change the deployed
contract. You can pass a WASM path and manifest path explicitly when verifying
another artifact or network.

```bash
bash scripts/verify-wasm-hash.sh path/to/payloop_invoice.wasm path/to/deployment.json
```

### Reproducibility findings

Rust's WASM code generation can change between compiler releases, so the former
floating `stable` toolchain could not provide a durable byte-for-byte claim.
The pinned Rust version, target, locked dependencies, and release profile now
make the build inputs explicit across machines. The CI summary is the canonical
reference for each commit; contributors should run the command above and
compare its SHA-256 before treating a local build as equivalent. A matching
hash is the evidence that a particular machine produced the same artifact.

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

## 3. Deploy the invoice contract (constructor sets admin and token)

The admin and payment token are passed as constructor arguments on the
deploy command itself, so they are set inside the deployment transaction.
Nobody can initialize the instance first: there is no separate step to race.

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/payloop_invoice.wasm \
  --source deployer \
  --network testnet \
  -- --admin $(stellar keys address deployer) \
  --payment_token TOKEN_ID
# -> prints the contract address  (CONTRACT_ID)
```

## 4. Record addresses

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_CONTRACT_ID` | CONTRACT_ID |
| `NEXT_PUBLIC_TOKEN_ID` | TOKEN_ID |
| `NEXT_PUBLIC_NETWORK` | `TESTNET` |
| `NEXT_PUBLIC_RPC_URL` | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` |

Also update `deployment.testnet.json` with the new `contractId`,
`wasmHash`, `deployedAt` date, and `contractVersion`, which must match what
`version()` returns on the new instance:

```bash
stellar contract invoke \
  --id CONTRACT_ID \
  --source deployer \
  --network testnet \
  -- version
```

## 5. Faucet for onboarded users (mint test USDC)

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
