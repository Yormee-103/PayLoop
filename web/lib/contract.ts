// Contract interaction layer. Builds, simulates, signs (via the active wallet), and
// submits Soroban transactions against the PayLoop invoice contract. Read-only
// calls are simulated and never leave the browser as a real transaction.

import {
  Account,
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
import { config, getTokenConfig, tokens } from "./config";
import { errorMessage } from "./async-resource";
import { parseTokenBalance } from "./invoice-helpers";
import { isValidInvoiceId } from "./invoice-helpers";
import { buildFundInvoiceCall } from "./fund-invoice-call";
import { signXdr } from "./wallet";
import {
  createScanCache,
  scanInvoices,
  type InvoiceScanResult,
  type ScanCache,
} from "./invoice-scan";

export type InvoiceStatus = "Pending" | "Paid";

export type TokenMetadata = { symbol: string; decimals: number };

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

/** Values that scValToNative may return for the invoice struct's fields. */
type RawScalar = string | number | bigint | { toString(): string };
type RawStatus = number | string | { tag?: string };

/** Contract decoding shape. Missing fields fall back to zero/empty values. */
export type RawInvoice = {
  id?: RawScalar;
  freelancer?: RawScalar;
  client?: RawScalar;
  token?: RawScalar;
  amount?: RawScalar;
  description?: string;
  due_date?: RawScalar;
  status?: RawStatus;
  created_at?: RawScalar;
  paid_at?: RawScalar;
};

/** A failed simulation, distinct from transport errors that should propagate. */
class ContractSimulationError extends Error {}

function server(): rpc.Server {
  return new rpc.Server(config.rpcUrl, {
    allowHttp: config.rpcUrl.startsWith("http://"),
  });
}

function contract(): Contract {
  return new Contract(config.contractId);
}

function toBigInt(value?: RawScalar): bigint {
  return BigInt(value?.toString() ?? "0");
}

// Map the contract's raw return (an enum/struct via scValToNative) to Invoice.
function decodeInvoice(raw: RawInvoice): Invoice {
  // The contract's InvoiceStatus is a #[repr(u32)] enum (Pending = 0, Paid = 1),
  // so scValToNative gives us a plain number. Older/other encodings may surface
  // it as a { tag } object or a string, so handle all three.
  const rawStatus = raw.status;
  const taggedStatus =
    typeof rawStatus === "object" && rawStatus !== null
      ? rawStatus.tag
      : undefined;
  const isPaid =
    rawStatus === 1 || rawStatus === "Paid" || taggedStatus === "Paid";
  const status: InvoiceStatus = isPaid ? "Paid" : "Pending";
  return {
    id: raw.id?.toString() ?? "0",
    freelancer: raw.freelancer?.toString?.() ?? String(raw.freelancer),
    client: raw.client?.toString?.() ?? String(raw.client),
    token: raw.token?.toString?.() ?? String(raw.token),
    amount: toBigInt(raw.amount),
    description: raw.description ?? "",
    dueDate: toBigInt(raw.due_date),
    status,
    createdAt: toBigInt(raw.created_at),
    paidAt: toBigInt(raw.paid_at),
  };
}

// --- Read-only calls (simulate only) --------------------------------------

async function simulateContractRead(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
): Promise<unknown> {
  const srv = server();
  const account = await srv.getAccount(config.readSource).catch(() => null);
  // Fall back to a throwaway account for pure reads if the read-source isn't
  // funded; simulation does not require a real signer.
  const source = account ?? new Account(config.readSource, "0");

  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await srv.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new ContractSimulationError(sim.error);
  }
  if (!sim.result?.retval) {
    return null;
  }
  return scValToNative(sim.result.retval);
}

function simulateRead(method: string, args: xdr.ScVal[]): Promise<unknown> {
  return simulateContractRead(config.contractId, method, args);
}

// Token symbol and decimals come from the token contract (SEP-41), not from
// global config, so an invoice denominated in a 6-decimal token formats
// correctly. Failed reads fall back to the configured values.
const tokenMetadataCache = new Map<string, TokenMetadata>();

export async function getTokenMetadata(
  tokenId: string = config.tokenId,
): Promise<TokenMetadata> {
  const cached = tokenMetadataCache.get(tokenId);
  if (cached) return cached;
  const fallback = getTokenConfig(tokenId);
  let meta: TokenMetadata = {
    symbol: fallback.symbol,
    decimals: fallback.decimals,
  };
  try {
    const [symbol, decimals] = await Promise.all([
      simulateContractRead(tokenId, "symbol", []),
      simulateContractRead(tokenId, "decimals", []),
    ]);
    meta = {
      symbol: symbol ? String(symbol) : meta.symbol,
      decimals:
        decimals === undefined || decimals === null
          ? meta.decimals
          : Number(decimals),
    };
    tokenMetadataCache.set(tokenId, meta);
  } catch {
    // Keep the config fallback; a token that can't be read still renders.
  }
  return meta;
}

// The contract's allowlist is authoritative; a v1 deployment without this
// entrypoint simply falls back to the configured tokens.
export async function getAllowedTokenIds(): Promise<string[]> {
  try {
    const raw = await simulateRead("get_allowed_tokens", []);
    if (Array.isArray(raw) && raw.length > 0) {
      return (raw as unknown[]).map((id) => String(id));
    }
  } catch {
    // v1 contract: no allowlist entrypoint.
  }
  return tokens.map((t) => t.id);
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  // Ids that can never exist (non-numeric, negative, > u64::MAX) are "not
  // found" without touching the RPC or throwing from BigInt().
  if (!isValidInvoiceId(id)) return null;
  try {
    const raw = await simulateRead("get_invoice", [
      nativeToScVal(BigInt(id), { type: "u64" }),
    ]);
    return raw ? decodeInvoice(raw as RawInvoice) : null;
  } catch (e) {
    if (errorMessage(e, "").includes("InvoiceNotFound")) return null;
    throw e;
  }
}

export async function getInvoiceHistory(
  freelancer: string,
): Promise<Invoice[]> {
  const raw = await simulateRead("get_invoice_history", [
    new Address(freelancer).toScVal(),
  ]);
  if (!Array.isArray(raw)) return [];
  return (raw as RawInvoice[]).map(decodeInvoice);
}

// Walks invoice ids from 1 upward until the first gap / not-found, producing a
// global feed of every invoice on the contract. This backs the public Activity
// page (proof of wallet interactions) and does not depend on RPC event
// retention. `max` bounds the scan so a large ledger can't hang the UI.
//
// The result reports RPC failures and a reached cap instead of hiding them,
// and a short-lived cache keeps History and Activity from scanning twice.
const SCAN_CACHE_TTL_MS = 30_000;
const scanCaches = new Map<number, ScanCache<InvoiceScanResult<Invoice>>>();

function scanCacheFor(max: number): ScanCache<InvoiceScanResult<Invoice>> {
  let cache = scanCaches.get(max);
  if (!cache) {
    cache = createScanCache<InvoiceScanResult<Invoice>>(SCAN_CACHE_TTL_MS);
    scanCaches.set(max, cache);
  }
  return cache;
}

export function getAllInvoices(max = 250): Promise<InvoiceScanResult<Invoice>> {
  return scanCacheFor(max).get(() =>
    scanInvoices((id) => getInvoice(String(id)), { max }),
  );
}

export function clearInvoiceScanCache(): void {
  scanCaches.clear();
}

export async function getTokenBalance(
  address: string,
  tokenId: string = config.tokenId,
): Promise<bigint> {
  // Failures (simulation errors, RPC errors, a missing return value) must
  // surface to the caller: returning 0n here made the UI show a false
  // "0 USDC" and an insufficient-balance prompt. Callers show "—" on error.
  const raw = await simulateContractRead(tokenId, "balance", [
    new Address(address).toScVal(),
  ]);
  return parseTokenBalance(raw);
}

// --- Write calls (simulate -> prepare -> sign -> submit) ------------------

async function invokeSigned(
  sourceAddress: string,
  method: string,
  args: xdr.ScVal[],
): Promise<{ hash: string; returnValue: unknown }> {
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
    config.networkPassphrase,
  );

  const sent = await srv.sendTransaction(signedTx);
  if (sent.status === "ERROR") {
    throw new Error(
      `Transaction submission failed: ${JSON.stringify(sent.errorResult)}`,
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
      `Transaction did not succeed (status: ${getResult.status}).`,
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
  token?: string;
}): Promise<{ id: string; hash: string }> {
  const tokenId =
    params.token && params.token !== config.tokenId ? params.token : null;
  const { hash, returnValue } = await invokeSigned(
    params.freelancer,
    tokenId ? "create_invoice_with_token" : "create_invoice",
    [
      new Address(params.freelancer).toScVal(),
      new Address(params.client).toScVal(),
      nativeToScVal(params.amount, { type: "i128" }),
      nativeToScVal(params.description, { type: "string" }),
      nativeToScVal(params.dueDate, { type: "u64" }),
      ...(tokenId ? [new Address(tokenId).toScVal()] : []),
    ],
  );
  return {
    id:
      returnValue === null || returnValue === undefined
        ? "0"
        : String(returnValue),
    hash,
  };
}

export async function fundInvoice(
  payerAddress: string,
  invoiceId: string,
  thirdParty = false,
): Promise<{ hash: string }> {
  // Default: the named client signs and pays. A different wallet signs the
  // dedicated entrypoint, which records it as the actual payer on the event.
  const { method, args } = buildFundInvoiceCall(
    payerAddress,
    invoiceId,
    thirdParty,
  );
  const { hash } = await invokeSigned(payerAddress, method, args);
  return { hash };
}

// --- Trustline (classic asset behind each SAC) ----------------------------

function tokenAsset(tokenId: string, symbol: string): Asset {
  return new Asset(symbol, getTokenConfig(tokenId).issuer);
}

function horizon(): Horizon.Server {
  return new Horizon.Server(config.horizonUrl, {
    allowHttp: config.horizonUrl.startsWith("http://"),
  });
}

// True if `address` already trusts the asset behind `tokenId` (can hold/send
// it). The issuer itself implicitly "has" the asset and needs no trustline.
export async function hasTokenTrustline(
  address: string,
  tokenId: string = config.tokenId,
): Promise<boolean> {
  const issuer = getTokenConfig(tokenId).issuer;
  if (address === issuer) return true;
  const { symbol } = await getTokenMetadata(tokenId);
  try {
    const account = await horizon().loadAccount(address);
    return account.balances.some(
      (b) =>
        "asset_code" in b &&
        b.asset_code === symbol &&
        "asset_issuer" in b &&
        b.asset_issuer === issuer,
    );
  } catch {
    // Account not found / network error: treat as no trustline so the UI
    // prompts the user (funding an unfunded account is a separate concern).
    return false;
  }
}

// Builds a changeTrust op for the asset behind `tokenId`, signs it via
// the connected wallet, and submits through Horizon.
export async function establishTokenTrustline(
  address: string,
  tokenId: string = config.tokenId,
): Promise<{ hash: string }> {
  const { symbol } = await getTokenMetadata(tokenId);
  const h = horizon();
  const account = await h.loadAccount(address);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(Operation.changeTrust({ asset: tokenAsset(tokenId, symbol) }))
    .setTimeout(120)
    .build();

  const signedXdr = await signXdr(tx.toXDR());
  const signedTx = TransactionBuilder.fromXDR(
    signedXdr,
    config.networkPassphrase,
  );
  const res = await h.submitTransaction(signedTx);
  return { hash: res.hash };
}

// Default-token compatibility wrappers used by the faucet/onboarding flows.
export function hasUsdcTrustline(address: string): Promise<boolean> {
  return hasTokenTrustline(address, config.tokenId);
}

export function establishUsdcTrustline(
  address: string,
): Promise<{ hash: string }> {
  return establishTokenTrustline(address, config.tokenId);
}
