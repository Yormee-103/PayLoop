import { NextResponse } from "next/server";
import {
  Account,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Funded testnet account used purely as a simulation source for read calls (never signs).
const READ_SOURCE =
  "GBTDIHYJA4OPTDBDRKH5A5PHBSH7QVAEY46V27DCB24SXNRXIQNHSNUM";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

function sanitizeErrorMessage(error: unknown): string {
  if (!error) return "Unknown error occurred.";
  let msg = error instanceof Error ? error.message : String(error);

  const issuerSecret = process.env.USDC_ISSUER_SECRET;
  if (issuerSecret && issuerSecret.length > 5) {
    msg = msg.replaceAll(issuerSecret, "[REDACTED_SECRET]");
  }
  const sentryAuth = process.env.SENTRY_AUTH_TOKEN;
  if (sentryAuth && sentryAuth.length > 5) {
    msg = msg.replaceAll(sentryAuth, "[REDACTED_TOKEN]");
  }
  const webhookUrl = process.env.FEEDBACK_WEBHOOK_URL;
  if (webhookUrl && webhookUrl.length > 5) {
    msg = msg.replaceAll(webhookUrl, "[REDACTED_URL]");
  }

  // Redact Stellar secret seeds (starts with 'S', 56 chars base32)
  msg = msg.replace(/\bS[A-Z2-7]{55}\b/g, "[REDACTED_SECRET]");

  // Redact authorization headers and query param tokens
  msg = msg.replace(/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, "$1[REDACTED]");
  msg = msg.replace(
    /([?&](?:token|key|secret|password|auth)=)[^&\s]+/gi,
    "$1[REDACTED]"
  );

  if (msg.length > 500) {
    msg = msg.slice(0, 500) + "... (truncated)";
  }

  return msg;
}

async function getLatestLedgerSequence(server: rpc.Server): Promise<number> {
  try {
    const latest = await server.getLatestLedger();
    if (typeof latest.sequence === "number") {
      return latest.sequence;
    }
  } catch {
    // When SDK XDR parser is not updated for a newer network protocol header,
    // fallback to getHealth() which also queries RPC and provides latestLedger.
    const health = await server.getHealth();
    if (typeof health.latestLedger === "number") {
      return health.latestLedger;
    }
  }
  throw new Error("Unable to retrieve latest ledger from Soroban RPC.");
}

async function getContractVersion(
  server: rpc.Server,
  contractId: string,
  networkPassphrase: string
): Promise<string> {
  const account = await server.getAccount(READ_SOURCE).catch(() => null);
  const source = account ?? new Account(READ_SOURCE, "0");
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(contract.call("version"))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Contract simulation failed: ${sim.error}`);
  }

  if (!sim.result?.retval) {
    throw new Error("Contract call returned empty result.");
  }

  const ver = scValToNative(sim.result.retval);
  return typeof ver === "string" ? ver : String(ver ?? "unknown");
}

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    const rpcUrl = config.rpcUrl;
    const contractId = config.contractId;
    const networkPassphrase = config.networkPassphrase;

    if (!rpcUrl || !contractId) {
      throw new Error("RPC URL or Contract ID is not configured.");
    }

    const server = new rpc.Server(rpcUrl, {
      allowHttp: rpcUrl.startsWith("http://"),
    });

    const [ledger, version] = await Promise.all([
      getLatestLedgerSequence(server),
      getContractVersion(server, contractId, networkPassphrase),
    ]);

    return NextResponse.json(
      {
        status: "ok",
        timestamp,
        ledger,
        contract: {
          status: "reachable",
          version,
        },
      },
      {
        status: 200,
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (err: unknown) {
    const sanitizedError = sanitizeErrorMessage(err);
    return NextResponse.json(
      {
        status: "degraded",
        timestamp,
        error: sanitizedError,
      },
      {
        status: 503,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}
