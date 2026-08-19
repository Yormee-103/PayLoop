#!/usr/bin/env node
// Regenerate docs/testnet-traction.csv directly from on-chain data.
//
// scripts/bot/assemble-docs.py builds this file by merging three sources —
// whatever was already in the CSV, a hardcoded pilot invoice, and
// scripts/bot/state.json — none of which is a query against the contract
// itself. Any invoice created outside those three sources (e.g. a real user
// invoice created directly through the web app) is invisible to it. That's
// how invoice id 15 fell out of the snapshot: it isn't bot-created (state.json
// only knows ids 17-43) and isn't the hardcoded pilot invoice (id 16), so no
// rerun of assemble-docs.py can ever pick it up.
//
// This script instead walks the deployed contract's get_invoice directly
// (same read-only simulateTransaction call as web/lib/contract.ts's
// getAllInvoices / scripts/bot/run-bot.mjs's getInvoiceOnChain) and writes
// every invoice id that actually exists on-chain, in the same column format.
//
// Usage:
//   node scripts/regenerate-traction-csv.mjs [--max 100]
//
// Requires web/node_modules (uses @stellar/stellar-sdk), same as run-bot.mjs.

import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = __dirname.endsWith("scripts") ? path.dirname(__dirname) : __dirname;
const DOCS = path.join(REPO, "docs");
const TRACTION_PATH = path.join(DOCS, "testnet-traction.csv");

const sdk = await import(
  pathToFileURL(path.join(REPO, "web/node_modules/@stellar/stellar-sdk/lib/esm/index.js"))
);

const NETWORK = "Test SDF Network ; September 2015";
const RPC = "https://soroban-testnet.stellar.org";
const CONTRACT_ID = "CAQVSBNVL7OI66IDTYCR7XL4VJKMSOYGBW5D6SWLTWTINTCQO2OGCSXS";
const READ_SOURCE = "GBTDIHYJA4OPTDBDRKH5A5PHBSH7QVAEY46V27DCB24SXNRXIQNHSNUM";
const EXPLORER_ACCOUNT = "https://stellar.expert/explorer/testnet/account/";
const EXPLORER_CONTRACT = `https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`;

const TRACTION_COLUMNS = [
  "invoice_id", "description", "amount_usdc", "status", "freelancer_address",
  "client_address", "created_at_utc", "paid_at_utc", "freelancer_explorer",
  "client_explorer", "contract_explorer",
];

const args = process.argv.slice(2);
const maxIdx = args.indexOf("--max");
const MAX_ID = maxIdx >= 0 ? parseInt(args[maxIdx + 1], 10) : 100;

const server = new sdk.rpc.Server(RPC, { allowHttp: true });
const contract = new sdk.Contract(CONTRACT_ID);

function utcStr(unixSeconds) {
  const n = Number(unixSeconds);
  if (!n) return "";
  return new Date(n * 1000).toISOString().replace("T", " ").replace(".000Z", " UTC");
}

// Same read as web/lib/contract.ts's decodeInvoice: InvoiceStatus is a
// #[repr(u32)] enum (Pending = 0, Paid = 1) on the wire.
async function getInvoiceOnChain(id) {
  const source = new sdk.Account(READ_SOURCE, "0");
  const tx = new sdk.TransactionBuilder(source, {
    fee: sdk.BASE_FEE,
    networkPassphrase: NETWORK,
  })
    .addOperation(contract.call("get_invoice", sdk.nativeToScVal(BigInt(id), { type: "u64" })))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (sdk.rpc.Api.isSimulationError(sim)) {
    return null; // InvoiceNotFound (or any other sim error) => no such invoice
  }
  if (!sim.result?.retval) return null;
  return sdk.scValToNative(sim.result.retval);
}

function toRow(id, inv) {
  const isPaid = inv.status === 1 || inv.status === "Paid" || inv.status?.tag === "Paid";
  const status = isPaid ? "Paid" : "Pending";
  const freelancer = inv.freelancer?.toString?.() ?? String(inv.freelancer);
  const client = inv.client?.toString?.() ?? String(inv.client);
  const amountHuman = Number(inv.amount ?? 0) / 10_000_000;
  return [
    String(id),
    inv.description ?? "",
    amountHuman.toFixed(2),
    status,
    freelancer,
    client,
    utcStr(inv.created_at),
    utcStr(inv.paid_at),
    EXPLORER_ACCOUNT + freelancer,
    EXPLORER_ACCOUNT + client,
    EXPLORER_CONTRACT,
  ];
}

function csvField(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function writeCsv(rows) {
  const lines = [TRACTION_COLUMNS.join(",")];
  for (const r of rows) lines.push(r.map(csvField).join(","));
  fs.writeFileSync(TRACTION_PATH, lines.join("\n") + "\n", "utf8");
}

async function main() {
  console.log(`Walking contract ${CONTRACT_ID} ids 1..${MAX_ID} for get_invoice...`);
  const rows = [];
  let missing = [];
  let lastFound = 0;
  for (let id = 1; id <= MAX_ID; id++) {
    const inv = await getInvoiceOnChain(id);
    if (!inv) {
      missing.push(id);
      // Stop once we've run 3 consecutive misses past the last hit — the
      // ledger's invoice ids aren't guaranteed gap-free (see id 15), so a
      // single miss shouldn't end the walk early.
      if (lastFound && id - lastFound > 3) break;
      continue;
    }
    lastFound = id;
    rows.push(toRow(id, inv));
    process.stdout.write(`  #${id} ${inv.description ?? ""} — ${inv.status === 1 || inv.status?.tag === "Paid" ? "Paid" : "Pending"}\n`);
  }

  rows.sort((a, b) => Number(a[0]) - Number(b[0]));
  writeCsv(rows);

  const paid = rows.filter((r) => r[3] === "Paid").length;
  const foundIds = rows.map((r) => Number(r[0]));
  const gaps = [];
  for (let i = foundIds[0]; i <= foundIds[foundIds.length - 1]; i++) {
    if (!foundIds.includes(i)) gaps.push(i);
  }
  console.log(`\nWrote ${rows.length} rows to ${path.relative(REPO, TRACTION_PATH)}`);
  console.log(`  ids ${foundIds[0]}..${foundIds[foundIds.length - 1]}, gaps: ${gaps.length ? gaps.join(", ") : "none"}`);
  console.log(`  Paid: ${paid}, Pending: ${rows.length - paid}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
