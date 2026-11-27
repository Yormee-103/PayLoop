# PayLoop invoice contract

A self-contained **Soroban invoice + instant-release escrow** contract written
with `soroban-sdk` 27. Any Stellar dApp that needs "request a payment, have it
settled atomically on-chain, keep an on-chain record of paid invoices" can reuse
it as-is: it is not tied to PayLoop's frontend. A default payment token is set
per deployment, and additional allowlisted tokens can be chosen per invoice
(it works with any token contract, including SACs for issued assets such as
USDC).

Deployed testnet instance (v1 WASM): see the addresses table in the root
[README](../../README.md) and
[`contracts/deployment.testnet.json`](../deployment.testnet.json). The
third-party payer entrypoint and the extra `payer` event topic change the ABI,
so they require a redeploy before the web app can call them on testnet.

## Lifecycle

```
                    create_invoice (freelancer signs)
                    ┌──────────────────────────────┐
                    │  status = Pending            │
                    └──────────────┬───────────────┘
                                   │  fund_invoice (client signs) or fund_invoice_as_payer (payer signs)
                                   │  1. require_auth(payer)
                                   │  2. balance(payer) >= amount
                                   │  3. token.transfer(payer → freelancer)
                                   ▼
                    ┌──────────────────────────────┐
                    │  status = Paid, paid_at set  │   (terminal state)
                    └──────────────────────────────┘
```

There are exactly two states (`Pending`, `Paid`) and one transition. Funding is
**instant release**: the contract never custodies funds — the transfer and the
status flip happen atomically in the payer's one transaction, so there is no
window where the contract can lose, withhold, or revert escrowed money.

`release_funds` is retained in the ABI as the seam for a future held-escrow
(milestone) model. In the deployed v1 design it performs **no state change and
no funds movement** — do not build against it.

## Storage model

| Key | Storage kind | Set by | Purpose |
| --- | --- | --- | --- |
| `Admin` | instance | `__constructor` | initializer address; only used to authorize growing the allowlist |
| `DefaultToken` | instance | `__constructor` | token contract used when `create_invoice` is called; immutable after construction |
| `AllowedTokens` | instance | `__constructor`, `add_allowed_token` | tokens an invoice may be created with; entries are never removed |
| `NextId` | instance | `create_invoice` | monotonically increasing invoice counter starting at 1 |
| `Invoice(id)` | persistent | `create_invoice`, `fund_invoice`, `fund_invoice_as_payer` | the full `Invoice` record |
| `History(freelancer)` | persistent | `create_invoice` | per-freelancer ordered list of invoice ids |
| `ClientHistory(client)` | persistent | `create_invoice` | per-client ordered list of invoice ids |

Known scaling limitation: `get_invoice_history` loads every invoice struct for
one freelancer in a single call. Past a few hundred invoices per freelancer a
deployed instance will hit Soroban read-footprint limits; a platform building
on this contract should page through `get_invoice_range(freelancer, start,
len)` instead of reading everything at once.
on this contract should use the paginated accessors `invoice_count(address)` +
`get_invoice_range(address, start, len)` rather than reading everything at once.
`get_client_history` is likewise unbounded per client and should be paged the
same way. Note: `invoice_count`, `get_invoice_range` and `get_client_history`
are **not yet on the deployed testnet contract**; they exist in source only and
require a fresh deployment to use.

## Entrypoints

| Function | Caller must authorize | Arguments | Returns | Emits |
| --- | --- | --- | --- | --- |
| `__constructor` | deployer (deployment transaction) | `admin`, `payment_token` | `()` | — |
| `add_allowed_token` | `admin` | `admin`, `token` | `()` | — |
| `create_invoice` | `freelancer` | `freelancer`, `client`, `amount` (i128), `description`, `due_date` (u64) | `u64` invoice id | `InvoiceCreated` |
| `create_invoice_with_token` | `freelancer` | `freelancer`, `client`, `amount` (i128), `description`, `due_date` (u64), `token` | `u64` invoice id | `InvoiceCreated` |
| `fund_invoice` | `invoice.client` | `invoice_id` | `()` | `InvoicePaid` |
| `fund_invoice_as_payer` | supplied `payer` | `invoice_id`, `payer` | `()` | `InvoicePaid` |
| `release_funds` | — (inert in v1) | `invoice_id` | `()` | — |
| `get_invoice` | read-only | `invoice_id` | `Invoice` | — |
| `invoice_count` | read-only | — | `u64` invoice count (0 before the first invoice) | — |
| `get_invoice_history` | read-only | `freelancer` | `Vec<Invoice>` | — |
| `get_invoice_range` | read-only | `freelancer`, `start` (u32), `len` (u32) | `Vec<Invoice>` | — |
| `invoice_count` | read-only | `freelancer` | `u32` | — |
| `get_invoice_range` | read-only | `freelancer`, `start`, `len` | `Vec<Invoice>` | — |
| `get_client_history` | read-only | `client` | `Vec<Invoice>` | — |
| `default_token_address` | read-only | — | token `Address` | — |
| `get_allowed_tokens` | read-only | — | `Vec<Address>` | — |
| `version` | read-only | — | `"v1"` symbol | — |

Semantics worth knowing:

- Only the **freelancer being credited** can create an invoice, so nobody can
  forge an invoice in someone else's payment history.
- `create_invoice` keeps the original five-argument ABI and uses the default
  token. `create_invoice_with_token` stores an explicit allowlisted token on the
  invoice; `fund_invoice` always transfers that stored token, never a global
  default.
- The allowlist only grows: removing a token would make existing unpaid
  invoices unfundable. The admin can add tokens but cannot rotate, pause, or
  recover funds.
- Funding always moves the **invoice amount that was recorded at creation**;
  the payer cannot pay a different amount and the freelancer cannot change the
  amount after creation.
- `due_date` is informational (rendered in UIs, used for overdue badges); the
  contract does not enforce it. There is no expiry: an overdue invoice can
  still be paid so late payments are not locked out.
- `invoice_count` returns the number of invoices ever created, **not** the next
  invoice id: it is `0` before the first invoice and `N` after `N` creations.
  Ids start at 1, so a client looping `1..=invoice_count()` visits exactly the
  ids that exist.
- Double funding is impossible: a second `fund_invoice` on a `Paid` invoice
  returns `AlreadyPaid`.
- Only the client named on the invoice can fund it: `fund_invoice` requires
  auth from `invoice.client` and transfers from that address. Third parties
  cannot pay another client's invoice. Allowing a third-party payer would be a
  future product change, not current behavior.
- Double funding is impossible: a second `fund_invoice` (or
  `fund_invoice_as_payer`) on a `Paid` invoice returns `AlreadyPaid`.
- Default rule: `fund_invoice` requires the named client's own authorization.
- Third-party rule: `fund_invoice_as_payer` lets any other address fund a
  `Pending` invoice, but the supplied `payer` must authorize both the
  entrypoint and the nested token transfer. The named client is unchanged; the
  freelancer cannot pay their own invoice this way (`InvalidParties`). This
  supports company treasuries and agencies paying on a client's behalf without
  weakening the default rule.

## Error codes

| Code | Name | Raised when |
| --- | --- | --- |
| 1 | `NotInitialized` | state missing — contract not constructed |
| 3 | `InvoiceNotFound` | unknown invoice id |
| 4 | `AlreadyPaid` | funding an already-`Paid` invoice |
| 5 | `InvalidAmount` | `amount <= 0` |
| 6 | `InvalidDescription` | empty `description` |
| 7 | `InvalidParties` | `freelancer == client`, or the freelancer supplied as the third-party `payer` |
| 8 | `InsufficientBalance` | payer's token balance below `invoice.amount` at fund time (advisory pre-check; the token transfer remains the authoritative check) |
| 9 | `TokenNotAllowed` | `create_invoice_with_token` called with a token outside the allowlist |

Codes 6–9 were appended after the original testnet deployment, so v1 wire
encodings of codes 1–5 are unchanged.

## Events

| Event | Topics | Data |
| --- | --- | --- |
| `InvoiceCreated` | `freelancer`, `client` | `id`, `amount` |
| `InvoicePaid` | `freelancer`, `client`, `payer` | `id`, `amount`, `paid_at` |

Marking users as topics means a platform can craft event claims
(`?topic0=...&topic1=<freelancer>`) against Soroban RPC to listen only for one
participant's activity, instead of scanning invoices.

## Build, test, verify

```bash
cd contracts/invoice
cargo test --locked                     # 27 unit tests (auth + edge cases)
cargo test                              # 23 unit tests (auth + edge cases)
cargo test                              # 32 unit tests (auth + edge cases)
cargo fmt --all --check
cargo clippy --all-targets --locked -- -D warnings
cargo build --locked --target wasm32v1-none --release
# -> ../target/wasm32v1-none/release/payloop_invoice.wasm
```

Full deploy walkthrough (keys, SAC, deployment, faucet): [../DEPLOYMENT.md](../DEPLOYMENT.md).
The contract CI (`.github/workflows/contract.yml`) runs all four steps above and
uploads the release WASM as an artifact on every push touching `contracts/`.
It builds and tests with `--locked`, treats clippy warnings as errors, and
reports the optimized wasm size in bytes in the job summary. The wasm size is
budgeted at 131072 bytes (128 KiB); the job fails above that budget.

> Note on the local dev dependency pin: `Cargo.toml` pins
> `ed25519-dalek = "=2.2.0"` because `soroban-env-host`'s testutils PRNG breaks
> with its 3.x line. Do not widen that pin without re-running the auth tests.

## Integration examples

Runnable examples live in [`../../examples/`](../../examples/README.md):

- [`examples/rust-cross-contract`](../../examples/rust-cross-contract): a small
  Soroban contract that calls `get_invoice` on a PayLoop contract.
- [`examples/node`](../../examples/node): a Node script that reads and creates
  an invoice with `@stellar/stellar-sdk`.

The snippets below use the **live testnet deployment**; the same code works
against any instance you deploy yourself.

### 1. TypeScript (browser or Node), `@stellar/stellar-sdk`

```ts
import {
  Address, BASE_FEE, Contract, nativeToScVal, scValToNative,
  rpc, TransactionBuilder,
} from "@stellar/stellar-sdk";

const CONTRACT_ID = "CAQVSBNVL7OI66IDTYCR7XL4VJKMSOYGBW5D6SWLTWTINTCQO2OGCSXS";
const RPC_URL = "https://soroban-testnet.stellar.org";
const PASSPHRASE = "Test SDF Network ; September 2015";

const server = new rpc.Server(RPC_URL);

export async function simulateRead(method: string, args: any[]) {
  // Simulate as a throwaway source: pure reads need no real signer/fee.
  const source = new (await import("@stellar/stellar-sdk")).Account(
    "GBTDIHYJA4OPTDBDRKH5A5PHBSH7QVAEY46V27DCB24SXNRXIQNHSNUM", "0");
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(new Contract(CONTRACT_ID).call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  return scValToNative(sim.result!.retval);
}

// Read one invoice (status: 0 = Pending, 1 = Paid).
export const readInvoice = (id: bigint | number) =>
  simulateRead("get_invoice", [nativeToScVal(BigInt(id), { type: "u64" })]);

export const readHistory = (freelancer: string) =>
  simulateRead("get_invoice_history", [new Address(freelancer).toScVal()]);
```

Writes (create/fund) follow the standard four-step flow — build →
`prepareTransaction` → Freighter wallet signature → `sendTransaction` + poll
`getTransaction` — which the PayLoop app implements in
[`web/lib/contract.ts`](../../web/lib/contract.ts) and is a working reference
for a Freighter-integrated integration.

### 2. CLI smoke test

```bash
stellar contract invoke --id CONTRACT_ID --source deployer --network testnet \
  -- create_invoice \
  --freelancer <FREELANCER_ADDR> --client <CLIENT_ADDR> \
  --amount 2000000000 --description "Landing page copy" --due_date 0

stellar contract invoke --id CONTRACT_ID --source deployer --network testnet \
  -- get_invoice --invoice_id 1
```

## Multi-token setup and v1 migration notes

A fresh deployment sets the allowlist to the default token during
construction (the deploy transaction). To invoice in another stablecoin, the admin first calls
`add_allowed_token(admin, token)` once per token, then freelancers use
`create_invoice_with_token`. The frontend reads `get_allowed_tokens` (falling
back to `NEXT_PUBLIC_TOKENS` on v1 deployments) for its token selector, reads
`symbol()`/`decimals()` from each token, and needs each SAC's classic asset
issuer in `NEXT_PUBLIC_TOKENS` to build trustlines.

Existing v1 invoices need no migration: their `Invoice.token` was already
stored at creation and `fund_invoice` has always used that field. They remain
fundable on the new deployment as long as their token is in the allowlist (the
default token always is). Because there is no in-place upgrade, point clients
at the new contract address and keep reading old invoices from the old
contract, or replay their records off-chain; do not assume old ids exist in the
new instance. Encoding of `Invoice` is unchanged, and the remaining error
codes keep their numbers (code 2, `AlreadyInitialized`, is gone with
`initialize`).

## Reuse notes

- **Token choice**: the constructor `__constructor(admin, payment_token)` accepts any Soroban
  token contract address (SAC or custom) as the default. Additional tokens are
  opt-in via `add_allowed_token`; every invoice stores the token it was created
  with and funding uses that token.
- **Decimals**: the contract is decimal-agnostic; amounts are raw `i128` base
  units. Your UI handles human conversion using each token's `decimals()`
  entrypoint (see `web/lib/contract.ts` and `web/lib/format.ts`).
- **What you'd extend for a real escrow**: replace instant release with
  `deposit` into the contract + `release_funds(invoice_id)` gated on a trigger,
  and add a `Refunded`/`Disputed` status on the enum. Renaming the enum's
  existing variants is a breaking change for stored data; additive variants
  are not.
- **Deploying your copy after edits** : there is no in-place upgrade path (no
  `set_admin`/upgrade function exists by design), so applying source changes
  means a fresh deploy with config re-pointed at the new addresses. Error
  codes 1-5 are unchanged and 6-8 are appended, so clients compiled against
  the v1 ABI keep working; the new create/fund validations are behavior
  changes rather than ABI breaks and belong in release notes when a v2
  instance ships.

## Resource budgets and thresholds

Soroban transactions enforce hard protocol ceilings on CPU instruction count and memory allocations. To prevent regressions where changes silently inflate resource consumption, `contracts/invoice/src/test.rs` records and asserts budget ceilings for every contract entrypoint using Soroban SDK 27 cost-estimation test utilities (`env.cost_estimate().budget()`).

### Observed entrypoint baselines and thresholds

| Entrypoint | Observed CPU | CPU Threshold | Observed Memory | Memory Threshold |
| :--- | :--- | :--- | :--- | :--- |
| `initialize` | ~75k | 200,000 | ~29k | 60,000 |
| `add_allowed_token` | ~96k | 200,000 | ~33k | 60,000 |
| `create_invoice` | ~212k | 500,000 | ~94k | 200,000 |
| `create_invoice_with_token` | ~238k | 500,000 | ~95k | 200,000 |
| `fund_invoice` | ~427k | 1,500,000 | ~154k | 300,000 |
| `release_funds` | ~80k | 300,000 | ~48k | 100,000 |
| `get_invoice` | ~86k | 300,000 | ~49k | 100,000 |
| `invoice_count` | ~52k | 200,000 | ~23k | 80,000 |
| `get_invoice_range` | ~155k | 600,000 | ~88k | 200,000 |
| `get_client_history` | ~155k | 600,000 | ~88k | 200,000 |
| `default_token_address` | ~53k | 200,000 | ~23k | 80,000 |
| `get_allowed_tokens` | ~54k | 200,000 | ~23k | 80,000 |
| `version` | ~38k | 150,000 | ~21k | 60,000 |
| `get_invoice_history` (2 items) | ~155k | 600,000 | ~87k | 200,000 |

### Scaling behavior

History reads scale linearly with the number of stored invoices:
- 1 invoice: ~103k CPU, ~58k memory
- 3 invoices: ~205k CPU, ~115k memory
- 6 invoices: ~361k CPU, ~200k memory
- 10 invoices: ~578k CPU, ~315k memory

For large accounts exceeding several dozen invoices, consumers must use `get_invoice_range` for pagination rather than reading complete history collections in one call.

### How to adjust thresholds

Thresholds are defined directly in `contracts/invoice/src/test.rs` inside `budget_regression_for_every_entrypoint` and `test_history_reads_scale_with_invoice_count`.

When updating contract logic or upgrading the Soroban SDK:
1. Run `cargo test budget -- --nocapture` to inspect newly recorded CPU and memory costs printed to the console.
2. If legitimate logic expansion increases resource usage, adjust the threshold constant in `test.rs` to maintain approximately 1.5x to 2x headroom above baseline while keeping safeguards against runaway complexity.
3. Update the thresholds table above to document the new baselines.

