// Health-check helpers. The route stays a thin adapter; the checks themselves
// take injectable functions so all success/failure combinations are testable.

import {
  Account,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";

export const HEALTH_CACHE_CONTROL = "no-store";

export type LedgerCheck =
  { ok: true; sequence: number; protocolVersion?: string } | { ok: false };

export type ContractCheck = { ok: true; version: string } | { ok: false };

export type HealthResult = {
  status: 200 | 503;
  body: {
    status: "healthy" | "degraded";
    checks: { ledger: LedgerCheck; contract: ContractCheck };
  };
};

export function evaluateLedger(value: unknown): LedgerCheck {
  if (typeof value !== "object" || value === null) return { ok: false };
  const ledger = value as { sequence?: unknown; protocolVersion?: unknown };
  if (
    typeof ledger.sequence !== "number" ||
    !Number.isInteger(ledger.sequence) ||
    ledger.sequence <= 0
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    sequence: ledger.sequence,
    ...(typeof ledger.protocolVersion === "string"
      ? { protocolVersion: ledger.protocolVersion }
      : {}),
  };
}

export function evaluateContractVersion(value: unknown): ContractCheck {
  if (value === undefined || value === null) return { ok: false };
  const version = String(value);
  return version.length > 0 ? { ok: true, version } : { ok: false };
}

function buildResult(
  ledger: LedgerCheck,
  contract: ContractCheck,
): HealthResult {
  const healthy = ledger.ok && contract.ok;
  return {
    status: healthy ? 200 : 503,
    body: {
      status: healthy ? "healthy" : "degraded",
      checks: { ledger, contract },
    },
  };
}

export async function runHealthChecks(deps: {
  getLatestLedger: () => Promise<unknown>;
  simulateVersion: () => Promise<unknown>;
}): Promise<HealthResult> {
  // allSettled ensures one failed dependency never hides the other check.
  const [ledgerSettled, contractSettled] = await Promise.allSettled([
    Promise.resolve().then(deps.getLatestLedger),
    Promise.resolve().then(deps.simulateVersion),
  ]);

  const ledger: LedgerCheck =
    ledgerSettled.status === "fulfilled"
      ? evaluateLedger(ledgerSettled.value)
      : { ok: false };
  const contract: ContractCheck =
    contractSettled.status === "fulfilled"
      ? evaluateContractVersion(contractSettled.value)
      : { ok: false };

  return buildResult(ledger, contract);
}

export type HealthConfig = {
  rpcUrl: string;
  contractId: string;
  readSource: string;
  networkPassphrase: string;
};

async function simulateVersion(
  server: rpc.Server,
  params: HealthConfig,
): Promise<unknown> {
  const account = await server.getAccount(params.readSource).catch(() => null);
  // Simulations do not need a funded signer; fall back to a throwaway account
  // exactly like the app's read-only contract helpers.
  const source = account ?? new Account(params.readSource, "0");
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: params.networkPassphrase,
  })
    .addOperation(new Contract(params.contractId).call("version"))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error("contract simulation failed");
  }
  if (!sim.result?.retval) return null;
  return scValToNative(sim.result.retval);
}

export async function checkPayloopHealth(
  params: HealthConfig,
): Promise<HealthResult> {
  try {
    const server = new rpc.Server(params.rpcUrl, {
      allowHttp: params.rpcUrl.startsWith("http://"),
    });
    return await runHealthChecks({
      getLatestLedger: () => server.getLatestLedger(),
      simulateVersion: () => simulateVersion(server, params),
    });
  } catch {
    // Never include the error text: it may contain RPC URLs or config details.
    return buildResult({ ok: false }, { ok: false });
  }
}
