# PayLoop integration examples

Two small examples of using the PayLoop invoice contract from outside the web
app. Both default to the public testnet deployment (contract address in the
root [README](../README.md)); see each section for how to point them at your
own. The contract's functions and errors are documented in
[`contracts/invoice/README.md`](../contracts/invoice/README.md).

## Rust: calling PayLoop from another contract

[`rust-cross-contract/`](rust-cross-contract) is a standalone Soroban contract,
`InvoiceReader`, that takes a PayLoop contract address and invoice id and:

| Function | Returns |
| --- | --- |
| `invoice_status(payloop, invoice_id)` | `Some(Pending)`, `Some(Paid)`, or `None` if the invoice does not exist |
| `is_paid(payloop, invoice_id)` | `true` only for an existing, paid invoice |
| `paid_amount_for(payloop, invoice_id, freelancer)` | the invoice amount if it is paid and was issued by `freelancer`, otherwise `0` |

It declares the slice of PayLoop's interface it needs with `#[contractclient]`
and mirrors the `Invoice` and `InvoiceStatus` types. Build it:

```bash
cd examples/rust-cross-contract
cargo build --target wasm32v1-none --release
```

Deploy it and call it with the Stellar CLI, passing the PayLoop contract
address as `--payloop`:

```bash
stellar contract invoke --id <READER_CONTRACT_ID> --source deployer --network testnet \
  -- is_paid --payloop <PAYLOOP_CONTRACT_ID> --invoice_id 1
```

Keep the mirrored types in `src/lib.rs` in step with
`contracts/invoice/src/lib.rs` if the invoice struct ever changes.

## Node: reading and creating invoices

[`node/`](node) is one script, `payloop.mjs`, using `@stellar/stellar-sdk`.
It needs Node 22 or newer.

```bash
cd examples/node
npm install

# Read an invoice (no key needed)
node payloop.mjs read 1

# Create an invoice. The secret key becomes the freelancer; use a funded
# testnet account only.
STELLAR_SECRET=S... node payloop.mjs create <CLIENT_ADDRESS> 12.5 "Landing page copy"
```

The functions `readInvoice` and `createInvoice` can also be imported from the
script. Override `PAYLOOP_CONTRACT_ID`, `RPC_URL` and `NETWORK_PASSPHRASE` to use
another deployment. Amounts are written in whole tokens (the default token has
7 decimals). The script never reads or stores a key except from the
`STELLAR_SECRET` environment variable.

## Status

These examples were written against the contract source and the web app's
client code. They have **not** been built or run in CI, which does not cover
`examples/`. Report anything that does not work as written.
