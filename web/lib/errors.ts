// Plain-language errors for everything that can go wrong while talking to the
// wallet, the RPC node and the invoice contract.
//
// The SDKs report failures as raw text ("HostError: Error(Contract, #4)", a
// JSON blob for a rejected submission, "[object Object]" for a wallet error).
// None of that is useful to someone paying an invoice. Every failure is
// converted to a `PayLoopError` with a stable `code`, a message that is safe
// to show, and, when a transaction was already sent, its hash.
//
// This module is pure (no SDK, no React) so it can be unit tested directly.

export type ContractErrorCode =
  | "NOT_INITIALIZED"
  | "ALREADY_INITIALIZED"
  | "INVOICE_NOT_FOUND"
  | "ALREADY_PAID"
  | "INVALID_AMOUNT"
  | "INVALID_DESCRIPTION"
  | "INVALID_PARTIES"
  | "INSUFFICIENT_BALANCE"
  | "TOKEN_NOT_ALLOWED";

export type PayLoopErrorCode =
  | ContractErrorCode
  // The token contract (not the invoice contract) refused the call.
  | "TOKEN_REJECTED"
  // The wallet.
  | "USER_REJECTED"
  | "WALLET_UNAVAILABLE"
  // The account.
  | "ACCOUNT_NOT_FOUND"
  | "INSUFFICIENT_XLM"
  | "TRUSTLINE_MISSING"
  // The network, before anything was submitted. Safe to retry.
  | "NETWORK"
  | "NETWORK_BUSY"
  | "SUBMIT_REJECTED"
  // After submission.
  | "TIMEOUT"
  | "TX_FAILED"
  | "UNKNOWN";

// Codes from contracts/invoice/README.md ("Error codes"). Keep in step with the
// `Error` enum in contracts/invoice/src/lib.rs.
export const CONTRACT_ERROR_CODES: Record<number, ContractErrorCode> = {
  1: "NOT_INITIALIZED",
  2: "ALREADY_INITIALIZED",
  3: "INVOICE_NOT_FOUND",
  4: "ALREADY_PAID",
  5: "INVALID_AMOUNT",
  6: "INVALID_DESCRIPTION",
  7: "INVALID_PARTIES",
  8: "INSUFFICIENT_BALANCE",
  9: "TOKEN_NOT_ALLOWED",
};

export const ERROR_MESSAGES: Record<PayLoopErrorCode, string> = {
  NOT_INITIALIZED:
    "The invoice contract hasn't been set up yet, so it can't be used right now. Please contact the PayLoop team.",
  ALREADY_INITIALIZED: "The invoice contract has already been set up.",
  INVOICE_NOT_FOUND:
    "We couldn't find that invoice. Check the link and try again.",
  ALREADY_PAID: "This invoice has already been paid.",
  INVALID_AMOUNT: "The amount must be greater than zero.",
  INVALID_DESCRIPTION: "Add a description for the invoice. It can't be empty.",
  INVALID_PARTIES:
    "The freelancer and the client can't be the same wallet. Use a different client address.",
  INSUFFICIENT_BALANCE:
    "Your wallet doesn't hold enough of this token to pay the invoice. Add funds and try again.",
  TOKEN_NOT_ALLOWED:
    "This token isn't accepted for invoices. Choose a different token.",
  TOKEN_REJECTED:
    "The token contract rejected the payment. Check your balance and that both wallets can hold this token, then try again.",
  USER_REJECTED:
    "You declined the request in your wallet, so nothing was sent. Try again when you're ready.",
  WALLET_UNAVAILABLE:
    "We couldn't reach your wallet. Make sure Freighter is installed and unlocked, then try again.",
  ACCOUNT_NOT_FOUND:
    "Your wallet account isn't active on this network yet. Send it some XLM, then try again.",
  INSUFFICIENT_XLM:
    "Your wallet doesn't have enough XLM to cover the network fee. Add a little XLM and try again.",
  TRUSTLINE_MISSING:
    "The receiving wallet hasn't enabled this token yet, so it can't receive the payment. Ask them to enable it, then try again.",
  NETWORK:
    "We couldn't reach the network. Check your connection and try again. Nothing was sent.",
  NETWORK_BUSY:
    "The network is busy right now. Nothing was sent. Wait a moment and try again.",
  SUBMIT_REJECTED:
    "The network didn't accept the transaction, so nothing was sent. Please try again.",
  TIMEOUT:
    "Your transaction was sent, but we haven't been able to confirm it yet. It may still go through. Check the explorer before trying again.",
  TX_FAILED:
    "The network processed the transaction but it didn't go through, so nothing was changed. Check the explorer for details.",
  UNKNOWN: "Something went wrong. Please try again.",
};

export type PayLoopErrorInit = {
  /** Hash of the transaction, when one was already submitted. */
  txHash?: string;
  /** The original error or value, kept for logging. Never shown to users. */
  cause?: unknown;
  /** Overrides the standard message for `code`. */
  message?: string;
};

export class PayLoopError extends Error {
  code: PayLoopErrorCode;
  txHash: string | undefined;
  cause: unknown;

  constructor(code: PayLoopErrorCode, init: PayLoopErrorInit = {}) {
    super(init.message ?? ERROR_MESSAGES[code]);
    this.name = "PayLoopError";
    this.code = code;
    this.txHash = init.txHash;
    this.cause = init.cause;
  }
}

export function isPayLoopError(value: unknown): value is PayLoopError {
  return value instanceof PayLoopError;
}

/**
 * True when the transaction may still land on chain, so the UI must not say it
 * failed and must not invite a blind retry (which could pay twice).
 */
export function isOutcomeUnknown(value: unknown): boolean {
  return isPayLoopError(value) && value.code === "TIMEOUT";
}

// ── classification helpers ──────────────────────────────────────────────────

function rawText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const m = (value as { message?: unknown }).message;
    if (typeof m === "string") return m;
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return value === undefined || value === null ? "" : String(value);
}

/**
 * Name of the result code in an `xdr.TransactionResult` (for example
 * `txInsufficientBalance` or `txFailed`), or null when `result` isn't one.
 */
export function txResultName(result: unknown): string | null {
  try {
    const r = result as {
      result: () => { switch: () => { name: string } };
    };
    const name = r.result().switch().name;
    return typeof name === "string" ? name : null;
  } catch {
    return null;
  }
}

function codeForResultName(name: string | null): PayLoopErrorCode | null {
  if (!name) return null;
  if (name === "txInsufficientBalance" || name === "txInsufficientFee") {
    return "INSUFFICIENT_XLM";
  }
  return null;
}

const CONTRACT_ID_RE = /\bC[A-Z2-7]{55}\b/g;
const CONTRACT_ERROR_RE = /Error\(Contract,\s*#(\d+)\)/g;

/**
 * The simulation error is raw text: `HostError: Error(Contract, #4)` followed by
 * a diagnostic event log. Token contracts use their own numbering, which can
 * collide with ours, so when we know the invoice contract's id an error that is
 * clearly attributed to a different contract is not read as one of ours.
 */
function findContractError(
  text: string,
  contractId?: string,
): { code: number; foreign: boolean } | null {
  // The headline ("HostError: Error(Contract, #8)") names no contract; the
  // diagnostic events below it do. So prefer the events: if any of them is
  // attributed to our contract that is the answer, if all of them point at
  // other contracts the error is not ours, and only without any attribution
  // do we trust the bare code.
  const unattributed: number[] = [];
  const ours: number[] = [];
  const others: number[] = [];
  for (const line of text.split(/\r?\n/)) {
    const ids: string[] = line.match(CONTRACT_ID_RE) ?? [];
    for (const m of line.matchAll(CONTRACT_ERROR_RE)) {
      const code = Number(m[1]);
      if (!contractId || ids.length === 0) unattributed.push(code);
      else if (ids.includes(contractId)) ours.push(code);
      else others.push(code);
    }
  }
  if (ours.length > 0) return { code: ours[0], foreign: false };
  if (others.length > 0) return { code: others[0], foreign: true };
  if (unattributed.length > 0) return { code: unattributed[0], foreign: false };
  return null;
}

/**
 * Turn anything thrown by the wallet, the RPC node or our own code into a
 * `PayLoopError`. A value that already is one passes through unchanged.
 */
export function toPayLoopError(
  cause: unknown,
  opts: { contractId?: string; txHash?: string } = {},
): PayLoopError {
  if (isPayLoopError(cause)) return cause;
  const text = rawText(cause);
  const init = { cause, txHash: opts.txHash };

  // Freighter reports a declined request as { code: -4, message: ... }.
  const walletCode =
    cause && typeof cause === "object"
      ? (cause as { code?: unknown }).code
      : undefined;
  if (
    walletCode === -4 ||
    /user (rejected|declined|denied|cancel)|rejected (this|the) request|declined|denied/i.test(
      text,
    )
  ) {
    return new PayLoopError("USER_REJECTED", init);
  }

  const contractError = findContractError(text, opts.contractId);
  if (contractError) {
    if (contractError.foreign) {
      return new PayLoopError("TOKEN_REJECTED", init);
    }
    const code = CONTRACT_ERROR_CODES[contractError.code];
    if (code) return new PayLoopError(code, init);
    return new PayLoopError("UNKNOWN", init);
  }

  if (/trustline entry is missing/i.test(text)) {
    return new PayLoopError("TRUSTLINE_MISSING", init);
  }
  if (/account not found|resource missing/i.test(text)) {
    return new PayLoopError("ACCOUNT_NOT_FOUND", init);
  }
  if (
    /tx_?insufficient_?(balance|fee)|insufficient (xlm|lumens|fee|native)|not enough xlm/i.test(
      text,
    )
  ) {
    return new PayLoopError("INSUFFICIENT_XLM", init);
  }
  if (
    /failed to fetch|networkerror|network error|load failed|econnrefused|econnreset|enotfound|etimedout|socket hang up|timeout of \d+ms|status code 5\d\d/i.test(
      text,
    )
  ) {
    return new PayLoopError("NETWORK", init);
  }
  if (/freighter|wallet (not found|is locked)|extension/i.test(text)) {
    return new PayLoopError("WALLET_UNAVAILABLE", init);
  }

  return new PayLoopError("UNKNOWN", init);
}

/** Message that is safe to show for any caught value. */
export function userMessage(
  cause: unknown,
  opts: { contractId?: string } = {},
): string {
  return toPayLoopError(cause, opts).message;
}

/**
 * Error for a transaction the node rejected at submission (`sendTransaction`
 * returned status ERROR). Nothing reached the ledger.
 */
export function submissionError(
  errorResult: unknown,
  txHash?: string,
): PayLoopError {
  const code =
    codeForResultName(txResultName(errorResult)) ?? "SUBMIT_REJECTED";
  return new PayLoopError(code, { cause: errorResult, txHash });
}

/**
 * Error for a transaction that was included in a ledger and failed
 * (`getTransaction` returned status FAILED).
 */
export function failedTransactionError(
  resultXdr: unknown,
  txHash: string,
): PayLoopError {
  const code = codeForResultName(txResultName(resultXdr)) ?? "TX_FAILED";
  return new PayLoopError(code, { cause: resultXdr, txHash });
}

/**
 * Error for a transaction that was sent but whose outcome we could not learn
 * in time. It must never say "failed": it may still be applied.
 */
export function timeoutError(txHash: string, cause?: unknown): PayLoopError {
  return new PayLoopError("TIMEOUT", { txHash, cause });
}

export type ErrorView = {
  code: PayLoopErrorCode;
  message: string;
  /** Set when a transaction was submitted; link it to the explorer. */
  txHash: string | null;
  /** The transaction may still land. Show as a notice, not as a failure. */
  unconfirmed: boolean;
};

/** Everything a screen needs to show a caught value. */
export function describeError(
  cause: unknown,
  opts: { contractId?: string } = {},
): ErrorView {
  const err = toPayLoopError(cause, opts);
  return {
    code: err.code,
    message: err.message,
    txHash: err.txHash ?? null,
    unconfirmed: isOutcomeUnknown(err),
  };
}
