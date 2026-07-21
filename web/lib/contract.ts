// Contract interaction layer. Builds, simulates, signs (via Freighter), and
// submits Soroban transactions against the PayLoop invoice contract. Read-only
// calls are simulated and never leave the browser as a real transaction.

import {
  Address,
  Asset,
  BASE_FEE,
  Contract,
  Horizon,
  nativeToScVal,
  Operation,
  scValToNative,
  TransactionBuilder,
  xdr,
  rpc,
} from "@stellar/stellar-sdk";
import { config } from "./config";
import { signXdr } from "./wallet";

export type InvoiceStatus = "Pending" | "Paid";

export type Invoice = {
  id: string;
  freelancer: string;
  client: string;
  token: string;
  amount: bigint;
  description: string;
  dueDate: bigint;
  status: InvoiceStatus;
  createdAt: bigint;
  paidAt: bigint;
};

function server(): rpc.Server {
  return new rpc.Server(config.rpcUrl, {
    allowHttp: config.rpcUrl.startsWith("http://"),
  });
}

function contract(): Contract {
  return new Contract(config.contractId);
}

// Map the contract's raw return (an enum/struct via scValToNative) to Invoice.
function decodeInvoice(raw: any): Invoice {
  // The contract's InvoiceStatus is a #[repr(u32)] enum (Pending = 0, Paid = 1),
  // so scValToNative gives us a plain number. Older/other encodings may surface
  // it as a { tag } object or a string, so handle all three.
  const rawStatus = raw.status;
  const isPaid =
    rawStatus === 1 ||
    rawStatus === "Paid" ||
    rawStatus?.tag === "Paid";
  const status: InvoiceStatus = isPaid ? "Paid" : "Pending";
  return {
    id: raw.id?.toString() ?? "0",
    freelancer: raw.freelancer?.toString?.() ?? String(raw.freelancer),
    client: raw.client?.toString?.() ?? String(raw.client),
    token: raw.token?.toString?.() ?? String(raw.token),
    amount: BigInt(raw.amount ?? 0),
    description: raw.description ?? "",
    dueDate: BigInt(raw.due_date ?? 0),
    status,
    createdAt: BigInt(raw.created_at ?? 0),
    paidAt: BigInt(raw.paid_at ?? 0),
  };
}

// --- Read-only calls (simulate only) --------------------------------------

async function simulateRead(method: string, args: xdr.ScVal[]): Promise<any> {
  const srv = server();
  const account = await srv.getAccount(READ_SOURCE).catch(() => null);
  // Fall back to a throwaway account for pure reads if the read-source isn't
  // funded; simulation does not require a real signer.
  const source =
    account ??
    new (await import("@stellar/stellar-sdk")).Account(READ_SOURCE, "0");

  const tx = new TransactionBuilder(source as any, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract().call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await srv.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }
  if (!sim.result?.retval) {
    return null;
  }
  return scValToNative(sim.result.retval);
}

// A well-known funded testnet account used purely as a simulation source for
// read calls (never signs anything). Falls back gracefully if unfunded.
const READ_SOURCE =
  "GBTDIHYJA4OPTDBDRKH5A5PHBSH7QVAEY46V27DCB24SXNRXIQNHSNUM";

export async function getInvoice(id: string): Promise<Invoice | null> {
  try {
    const raw = await simulateRead("get_invoice", [
      nativeToScVal(BigInt(id), { type: "u64" }),
    ]);
    return raw ? decodeInvoice(raw) : null;
  } catch (e: any) {
    if (String(e?.message).includes("InvoiceNotFound")) return null;
    throw e;
  }
}

export async function getInvoiceHistory(freelancer: string): Promise<Invoice[]> {
  const raw = await simulateRead("get_invoice_history", [
    new Address(freelancer).toScVal(),
  ]);
  if (!Array.isArray(raw)) return [];
  return raw.map(decodeInvoice);
}

// Walks invoice ids from 1 upward until the first gap / not-found, producing a
// global feed of every invoice on the contract. This backs the public Activity
// page (proof of wallet interactions) and does not depend on RPC event
// retention. `max` bounds the scan so a large ledger can't hang the UI.
export async function getAllInvoices(max = 250): Promise<Invoice[]> {
  const out: Invoice[] = [];
  for (let id = 1; id <= max; id++) {
    let inv: Invoice | null;
    try {
      inv = await getInvoice(String(id));
    } catch {
      break;
    }
    if (!inv) break;
    out.push(inv);
  }
  return out;
}

export async function getTokenBalance(address: string): Promise<bigint> {
  const srv = server();
  const token = new Contract(config.tokenId);
  const source = new (await import("@stellar/stellar-sdk")).Account(
    READ_SOURCE,
    "0"
  );
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(token.call("balance", new Address(address).toScVal()))
    .setTimeout(30)
    .build();
  const sim = await srv.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim) || !sim.result?.retval) return 0n;
  return BigInt(scValToNative(sim.result.retval) ?? 0);
}

// --- Write calls (simulate -> prepare -> sign -> submit) ------------------

async function invokeSigned(
  sourceAddress: string,
  method: string,
  args: xdr.ScVal[]
): Promise<{ hash: string; returnValue: any }> {
  const srv = server();
  const account = await srv.getAccount(sourceAddress);

  const built = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract().call(method, ...args))
    .setTimeout(60)
    .build();

  // Prepare = simulate + assemble auth/footprint/resource fees.
  const prepared = await srv.prepareTransaction(built);
  const signedXdr = await signXdr(prepared.toXDR());
  const signedTx = TransactionBuilder.fromXDR(
    signedXdr,
    config.networkPassphrase
  );

  const sent = await srv.sendTransaction(signedTx);
  if (sent.status === "ERROR") {
    throw new Error(
      `Transaction submission failed: ${JSON.stringify(sent.errorResult)}`
    );
  }

  // Poll for confirmation.
  let getResult = await srv.getTransaction(sent.hash);
  const started = Date.now();
  while (
    getResult.status === rpc.Api.GetTransactionStatus.NOT_FOUND &&
    Date.now() - started < 30_000
  ) {
    await new Promise((r) => setTimeout(r, 1500));
    getResult = await srv.getTransaction(sent.hash);
  }

  if (getResult.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(
      `Transaction did not succeed (status: ${getResult.status}).`
    );
  }

  const returnValue = getResult.returnValue
    ? scValToNative(getResult.returnValue)
    : null;
  return { hash: sent.hash, returnValue };
}

export async function createInvoice(params: {
  freelancer: string;
  client: string;
  amount: bigint;
  description: string;
  dueDate: bigint;
}): Promise<{ id: string; hash: string }> {
  const { hash, returnValue } = await invokeSigned(
    params.freelancer,
    "create_invoice",
    [
      new Address(params.freelancer).toScVal(),
      new Address(params.client).toScVal(),
      nativeToScVal(params.amount, { type: "i128" }),
      nativeToScVal(params.description, { type: "string" }),
      nativeToScVal(params.dueDate, { type: "u64" }),
    ]
  );
  return { id: returnValue?.toString() ?? "0", hash };
}

export async function fundInvoice(
  clientAddress: string,
  invoiceId: string
): Promise<{ hash: string }> {
  const { hash } = await invokeSigned(clientAddress, "fund_invoice", [
    nativeToScVal(BigInt(invoiceId), { type: "u64" }),
  ]);
  return { hash };
}

// --- Trustline (classic asset behind the USDC SAC) ------------------------

function usdcAsset(): Asset {
  return new Asset(config.tokenSymbol, config.tokenIssuer);
}

function horizon(): Horizon.Server {
  return new Horizon.Server(config.horizonUrl, {
    allowHttp: config.horizonUrl.startsWith("http://"),
  });
}

// True if `address` already trusts the USDC asset (can hold/send it). The
// issuer itself implicitly "has" the asset and never needs a trustline.
export async function hasUsdcTrustline(address: string): Promise<boolean> {
  if (address === config.tokenIssuer) return true;
  try {
    const account = await horizon().loadAccount(address);
    return account.balances.some(
      (b: any) =>
        b.asset_code === config.tokenSymbol &&
        b.asset_issuer === config.tokenIssuer
    );
  } catch {
    // Account not found / network error: treat as no trustline so the UI
    // prompts the user (funding an unfunded account is a separate concern).
    return false;
  }
}

// Builds a changeTrust op for the USDC asset, signs it via Freighter, and
// submits through Horizon. Lets a wallet receive/hold USDC without hunting
// for the asset in Freighter's UI.
export async function establishUsdcTrustline(
  address: string
): Promise<{ hash: string }> {
  const h = horizon();
  const account = await h.loadAccount(address);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(Operation.changeTrust({ asset: usdcAsset() }))
    .setTimeout(120)
    .build();

  const signedXdr = await signXdr(tx.toXDR());
  const signedTx = TransactionBuilder.fromXDR(
    signedXdr,
    config.networkPassphrase
  );
  const res = await h.submitTransaction(signedTx as any);
  return { hash: res.hash };
}
