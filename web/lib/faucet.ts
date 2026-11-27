// Server-only faucet helpers. Kept out of the Next route so validation,
// trustline checks and send-status mapping can be tested without Next's
// module resolution or a live Stellar network.

import {
  Address,
  BASE_FEE,
  Contract,
  Horizon,
  Keypair,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  rpc,
} from "@stellar/stellar-sdk";

export const MINT_AMOUNT = 5_000_000_000n; // 500 USDC at 7 decimals

// Fixed response strings. Internal error text, RPC URLs, XDR and secrets must
// never be interpolated into a response body.
export const FAUCET_MESSAGES = {
  invalidAddress: "A valid Stellar account address (G...) is required.",
  trustlineMissing:
    "This wallet must enable USDC before it can receive test USDC. Use Enable USDC on the dashboard, then retry.",
  trustlineUnavailable:
    "Could not verify the wallet's trustline. Please try again.",
  networkBusy: "The network is busy. Please try again shortly.",
  rejected: "Mint transaction was rejected.",
  unconfirmed: "Mint did not confirm in time. Try again shortly.",
  duplicatePending:
    "A mint for this wallet was already submitted. Check your balance before retrying.",
  unexpected: "Faucet failed unexpectedly. Please try again.",
} as const;

export type TrustlineState = "present" | "missing" | "unavailable";

export type MintOutcome =
  | { kind: "confirmed"; hash: string }
  | { kind: "duplicate-confirmed"; hash: string }
  | { kind: "duplicate-pending"; hash: string }
  | { kind: "busy" }
  | { kind: "rejected" }
  | { kind: "failed" }
  | { kind: "unconfirmed" };

export type FaucetResult = {
  status: number;
  body: { ok?: boolean; hash?: string; error?: string };
  headers?: Record<string, string>;
};

/** Account addresses start with G. Address.fromString would also accept C... */
export function isAccountAddress(value: unknown): value is string {
  return typeof value === "string" && StrKey.isValidEd25519PublicKey(value);
}

function errorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as {
    status?: unknown;
    response?: { status?: unknown };
  };
  const value = candidate.response?.status ?? candidate.status;
  return typeof value === "number" ? value : undefined;
}

function hasAssetLine(
  account: { balances: readonly unknown[] },
  symbol: string,
  issuer: string,
): boolean {
  return account.balances.some((line) => {
    if (typeof line !== "object" || line === null) return false;
    const balance = line as { asset_code?: unknown; asset_issuer?: unknown };
    return balance.asset_code === symbol && balance.asset_issuer === issuer;
  });
}

type LoadAccount = (
  address: string,
) => Promise<{ balances: readonly unknown[] }>;

/**
 * Distinguishes "no trustline" (409) from "Horizon unavailable" (502). The UI
 * helper hasTokenTrustline deliberately collapses both to false; the faucet
 * must not tell a user to add a trustline when Horizon simply failed.
 */
export type TrustlineParams = {
  issuer: string;
  symbol: string;
  horizonUrl: string;
  loadAccount?: LoadAccount;
};

export async function checkFaucetTrustline(
  address: string,
  params: TrustlineParams,
): Promise<TrustlineState> {
  if (address === params.issuer) return "present";

  const loadAccount: LoadAccount =
    params.loadAccount ??
    ((account) => {
      const horizon = new Horizon.Server(params.horizonUrl, {
        allowHttp: params.horizonUrl.startsWith("http://"),
      });
      return horizon.loadAccount(account);
    });

  try {
    const account = await loadAccount(address);
    return hasAssetLine(account, params.symbol, params.issuer)
      ? "present"
      : "missing";
  } catch (error) {
    return errorStatus(error) === 404 ? "missing" : "unavailable";
  }
}

export type SendStatusAction =
  "poll" | "poll-duplicate" | "busy" | "rejected" | "unknown";

export function mapSendStatus(status: string): SendStatusAction {
  switch (status) {
    case "PENDING":
      return "poll";
    case "DUPLICATE":
      return "poll-duplicate";
    case "TRY_AGAIN_LATER":
      return "busy";
    case "ERROR":
      return "rejected";
    default:
      return "unknown";
  }
}

async function waitForConfirmation(
  server: rpc.Server,
  hash: string,
): Promise<"success" | "not-success"> {
  let result = await server.getTransaction(hash);
  const started = Date.now();
  while (
    result.status === rpc.Api.GetTransactionStatus.NOT_FOUND &&
    Date.now() - started < 20_000
  ) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    result = await server.getTransaction(hash);
  }
  return result.status === rpc.Api.GetTransactionStatus.SUCCESS
    ? "success"
    : "not-success";
}

export type SubmitMintParams = {
  address: string;
  issuerSecret: string;
  tokenId: string;
  rpcUrl: string;
  passphrase: string;
  /** Injectable for tests; production uses the default rpc.Server polling. */
  waitForConfirmation?: (
    server: rpc.Server,
    hash: string,
  ) => Promise<"success" | "not-success">;
};

export async function submitMint(
  params: SubmitMintParams,
): Promise<MintOutcome> {
  try {
    const issuer = Keypair.fromSecret(params.issuerSecret);
    const server = new rpc.Server(params.rpcUrl, {
      allowHttp: params.rpcUrl.startsWith("http://"),
    });
    const source = await server.getAccount(issuer.publicKey());
    const token = new Contract(params.tokenId);

    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: params.passphrase,
    })
      .addOperation(
        token.call(
          "mint",
          new Address(params.address).toScVal(),
          nativeToScVal(MINT_AMOUNT, { type: "i128" }),
        ),
      )
      .setTimeout(60)
      .build();

    const prepared = await server.prepareTransaction(tx);
    prepared.sign(issuer);

    const sent = await server.sendTransaction(prepared);
    const wait = params.waitForConfirmation ?? waitForConfirmation;

    switch (mapSendStatus(sent.status)) {
      case "busy":
        return { kind: "busy" };
      case "rejected":
        return { kind: "rejected" };
      case "poll-duplicate": {
        const confirmed = await wait(server, sent.hash);
        return confirmed === "success"
          ? { kind: "duplicate-confirmed", hash: sent.hash }
          : { kind: "duplicate-pending", hash: sent.hash };
      }
      case "poll": {
        const confirmed = await wait(server, sent.hash);
        return confirmed === "success"
          ? { kind: "confirmed", hash: sent.hash }
          : { kind: "unconfirmed" };
      }
      case "unknown":
      default:
        return { kind: "failed" };
    }
  } catch (error) {
    console.error("[payloop:faucet] mint failed", error);
    return { kind: "failed" };
  }
}

function fail(
  status: number,
  message: string,
  retryAfter?: number,
): FaucetResult {
  return {
    status,
    body: { error: message },
    headers:
      retryAfter === undefined
        ? undefined
        : { "Retry-After": String(retryAfter) },
  };
}

export type FaucetDeps = {
  checkLimit: (ip: string, address: string) => Promise<number | null>;
  recordMint: (ip: string, address: string, amount: bigint) => Promise<void>;
  checkTrustline: (address: string) => Promise<TrustlineState>;
  mint: (address: string) => Promise<MintOutcome>;
};

export async function handleFaucetRequest(input: {
  address: unknown;
  ip: string;
  deps: FaucetDeps;
}): Promise<FaucetResult> {
  if (!isAccountAddress(input.address)) {
    return fail(400, FAUCET_MESSAGES.invalidAddress);
  }

  const address = input.address;
  try {
    const retryAfter = await input.deps.checkLimit(input.ip, address);
    if (retryAfter !== null) {
      return fail(
        429,
        `Faucet already dispensed to this wallet recently. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
        retryAfter,
      );
    }

    const trustline = await input.deps.checkTrustline(address);
    if (trustline === "unavailable") {
      return fail(502, FAUCET_MESSAGES.trustlineUnavailable);
    }
    if (trustline === "missing") {
      return fail(409, FAUCET_MESSAGES.trustlineMissing);
    }

    const outcome = await input.deps.mint(address);
    switch (outcome.kind) {
      case "confirmed":
      case "duplicate-confirmed":
        await input.deps.recordMint(input.ip, address, MINT_AMOUNT);
        return { status: 200, body: { ok: true, hash: outcome.hash } };
      case "duplicate-pending":
        return fail(409, FAUCET_MESSAGES.duplicatePending);
      case "busy":
        return {
          ...fail(503, FAUCET_MESSAGES.networkBusy),
          headers: { "Retry-After": "5" },
        };
      case "rejected":
        return fail(502, FAUCET_MESSAGES.rejected);
      case "unconfirmed":
        return fail(504, FAUCET_MESSAGES.unconfirmed);
      case "failed":
      default:
        return fail(500, FAUCET_MESSAGES.unexpected);
    }
  } catch (error) {
    console.error("[payloop:faucet] request failed", error);
    return fail(500, FAUCET_MESSAGES.unexpected);
  }
}
