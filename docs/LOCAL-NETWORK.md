# Developing against a Local Stellar Quickstart Network

This guide walks through running a self-contained local Stellar and Soroban network using the official `stellar/quickstart` Docker image. Developing locally provides:

- **Sub-second ledger closing** and fast transaction settlement.
- **Offline independence**: develop and test without internet connectivity.
- **Immunity from testnet resets**: your contracts and ledger state persist across sessions.
- **Unlimited test tokens**: fund any address via the local Friendbot without rate limits.

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) or [Podman](https://podman.io/)
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli) (`v22+`)
- [Node.js 22 LTS](https://nodejs.org/) and `npm`
- [Rust toolchain](https://rustup.rs/) with target `wasm32v1-none` (`rustup target add wasm32v1-none`)

---

## 1. Start the Stellar Quickstart Container

Run the local standalone network container with Soroban RPC and Friendbot enabled:

```bash
docker run --rm -it \
  -p 8000:8000 \
  --name stellar-local \
  stellar/quickstart:latest \
  --local \
  --enable-soroban-rpc
```

Once initialized, the following local services are active:

| Service | Local URL |
| :--- | :--- |
| **Soroban RPC** | `http://localhost:8000/soroban/rpc` |
| **Horizon API** | `http://localhost:8000` |
| **Friendbot** | `http://localhost:8000/friendbot` |
| **Passphrase** | `Standalone Network ; February 2017` |

---

## 2. Configure the Local Network in Stellar CLI

Register the `local` network profile in your global Stellar CLI configuration:

```bash
stellar network add \
  --global local \
  --rpc-url "http://localhost:8000/soroban/rpc" \
  --network-passphrase "Standalone Network ; February 2017"
```

Verify the network profile:

```bash
stellar network ls
```

---

## 3. Generate and Fund Local Developer Accounts

Create keypairs for the contract deployer and the mock USDC asset issuer. The `--fund` flag automatically requests starting lumens from local Friendbot:

```bash
# Deployer identity
stellar keys generate deployer --network local --fund

# Mock USDC asset issuer identity
stellar keys generate usdc-issuer --network local --fund
```

View public addresses:

```bash
stellar keys address deployer
stellar keys address usdc-issuer
```

---

## 4. Build and Deploy Contracts Locally

### A. Build the PayLoop Invoice Contract

```bash
cd contracts
stellar contract build
# Outputs: target/wasm32v1-none/release/payloop_invoice.wasm
```

### B. Deploy Mock USDC Token (Stellar Asset Contract)

Deploy a wrapped classic asset `USDC:<issuer>` as a Soroban token:

```bash
stellar contract asset deploy \
  --asset USDC:$(stellar keys address usdc-issuer) \
  --source deployer \
  --network local
```

*Record the returned contract address as `TOKEN_ID`.*

### C. Deploy the Invoice Smart Contract

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/payloop_invoice.wasm \
  --source deployer \
  --network local
```

*Record the returned contract address as `CONTRACT_ID`.*

### D. Initialize the Contract

Initialize the PayLoop contract with the admin and the local payment token:

```bash
stellar contract invoke \
  --id CONTRACT_ID \
  --source deployer \
  --network local \
  -- initialize \
  --admin $(stellar keys address deployer) \
  --payment_token TOKEN_ID
```

---

## 5. Configure the Frontend (`web/.env.local`)

Copy `web/.env.example` to `web/.env.local` and populate the local variables:

```bash
cd ../web
cp .env.example .env.local
```

Set the following variables in `web/.env.local`:

```env
# --- Local Stellar / Soroban Configuration ---
NEXT_PUBLIC_NETWORK=LOCAL
NEXT_PUBLIC_NETWORK_PASSPHRASE="Standalone Network ; February 2017"
NEXT_PUBLIC_RPC_URL=http://localhost:8000/soroban/rpc
NEXT_PUBLIC_CONTRACT_ID=<YOUR_CONTRACT_ID>
NEXT_PUBLIC_TOKEN_ID=<YOUR_TOKEN_ID>
NEXT_PUBLIC_TOKEN_DECIMALS=7
NEXT_PUBLIC_TOKEN_SYMBOL=USDC

# Secret key of usdc-issuer for the local faucet route (/api/faucet)
USDC_ISSUER_SECRET=<S_SECRET_FROM_STELLAR_KEYS_SHOW_USDC_ISSUER>
```

To reveal the issuer secret key:

```bash
stellar keys show usdc-issuer
```

---

## 6. Configure Freighter Wallet for Local Network

To sign transactions in the browser using the Freighter wallet:

1. Open the Freighter browser extension settings.
2. Select **Preferences** > **Networks** > **Add Custom Network**.
3. Enter the following parameters:
   - **Name**: `Stellar Local`
   - **Horizon RPC URL**: `http://localhost:8000`
   - **Soroban RPC URL**: `http://localhost:8000/soroban/rpc`
   - **Passphrase**: `Standalone Network ; February 2017`
4. Fund your Freighter address via the local Friendbot:
   ```bash
   curl "http://localhost:8000/friendbot?addr=<YOUR_FREIGHTER_PUBLIC_KEY>"
   ```

---

## 7. Run and Test the Application

Start the Next.js development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser:

1. Click **Connect Wallet** and select your Freighter wallet set to `Stellar Local`.
2. Click **Get test USDC** in the top navigation or banner to receive local tokens via `/api/faucet`.
3. Navigate to **New Invoice** (`/create`) and create an invoice.
4. Copy the payment link (`/pay/[id]`) and click **Confirm & Pay** to settle it on the local Soroban ledger in seconds.
5. Review the on-chain confirmation in **History** (`/history`), **Statement** (`/statement`), and **Activity** (`/activity`).

---

## Known Limitations & Differences

- **Container State Ephemerality**: If you run Docker without a volume mount (`--rm`), all ledger data, deployed contracts, and accounts will reset when the container terminates. To persist data across runs, mount a volume: `-v /local/storage/path:/opt/stellar`.
- **Explorer Availability**: Public explorers (such as stellar.expert) monitor public networks (Mainnet/Testnet). For local ledger inspection, query Horizon directly at `http://localhost:8000/ledgers` or inspect transactions via `stellar` CLI.
- **Third-Party Anchors**: SEP-24 / off-ramp services are unavailable on standalone networks and remain feature-flagged.
