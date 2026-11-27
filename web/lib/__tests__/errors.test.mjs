import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTRACT_ERROR_CODES,
  ERROR_MESSAGES,
  PayLoopError,
  describeError,
  failedTransactionError,
  isOutcomeUnknown,
  submissionError,
  timeoutError,
  toPayLoopError,
  txResultName,
  userMessage,
} from "../errors.ts";

const INVOICE = "C" + "A".repeat(55);
const TOKEN = "C" + "B".repeat(55);

// What `prepareTransaction` throws for a failed simulation: the host error
// first, then the diagnostic event log (newest first).
function simError(code, contractId = INVOICE) {
  return new Error(
    [
      `HostError: Error(Contract, #${code})`,
      "",
      "Event log (newest first):",
      `   0: [Diagnostic Event] contract:${contractId}, topics:[error, Error(Contract, #${code})], data:"escalating Ok(ScErrorType::Contract) frame-exit to Err"`,
    ].join("\n"),
  );
}

function resultXdr(name) {
  return { result: () => ({ switch: () => ({ name }) }) };
}

// ── contract codes 1-8 (and 9) ──────────────────────────────────────────────

test("every contract error code 1-9 maps to its own message", () => {
  const messages = new Set();
  for (let n = 1; n <= 9; n++) {
    const err = toPayLoopError(simError(n), { contractId: INVOICE });
    assert.equal(err.code, CONTRACT_ERROR_CODES[n], `code ${n}`);
    assert.equal(err.message, ERROR_MESSAGES[CONTRACT_ERROR_CODES[n]]);
    messages.add(err.message);
  }
  assert.equal(messages.size, 9, "each code has a distinct message");
});

test("contract messages are plain language, not SDK text", () => {
  for (let n = 1; n <= 9; n++) {
    const msg = userMessage(simError(n));
    assert.doesNotMatch(msg, /Error\(Contract|HostError|#\d|Diagnostic/);
  }
});

test("the code is found without a contract id and in a bare message", () => {
  assert.equal(toPayLoopError(simError(4)).code, "ALREADY_PAID");
  assert.equal(
    toPayLoopError(new Error("HostError: Error(Contract, #3)")).code,
    "INVOICE_NOT_FOUND",
  );
  assert.equal(toPayLoopError("Error(Contract,#5)").code, "INVALID_AMOUNT");
});

test("an unknown contract code is not mislabelled", () => {
  assert.equal(toPayLoopError(simError(42)).code, "UNKNOWN");
});

test("an error raised by another contract is not read as an invoice error", () => {
  // The token contract numbers its errors too; its #8 is not our
  // InsufficientBalance.
  const err = toPayLoopError(simError(8, TOKEN), { contractId: INVOICE });
  assert.equal(err.code, "TOKEN_REJECTED");
  assert.notEqual(err.code, "INSUFFICIENT_BALANCE");
});

test("an invoice error wins when a token frame appears in the same log", () => {
  const e = new Error(
    [
      "HostError: Error(Contract, #4)",
      `   0: [Diagnostic Event] contract:${INVOICE}, topics:[error, Error(Contract, #4)]`,
      `   1: [Diagnostic Event] contract:${TOKEN}, topics:[error, Error(Contract, #10)]`,
    ].join("\n"),
  );
  assert.equal(toPayLoopError(e, { contractId: INVOICE }).code, "ALREADY_PAID");
});

// ── wallet ──────────────────────────────────────────────────────────────────

test("a declined signature request is USER_REJECTED", () => {
  const freighter = { code: -4, message: "The user rejected this request." };
  const err = toPayLoopError(freighter);
  assert.equal(err.code, "USER_REJECTED");
  assert.match(err.message, /declined/i);
  assert.doesNotMatch(err.message, /object Object/);
});

test("a declined request is recognised from its text alone", () => {
  assert.equal(
    toPayLoopError(new Error("User declined access")).code,
    "USER_REJECTED",
  );
});

test("a wallet error object never turns into [object Object]", () => {
  const err = toPayLoopError({ code: -1, message: "Internal error" });
  assert.doesNotMatch(err.message, /object Object/);
});

// ── account and fees ────────────────────────────────────────────────────────

test("running out of XLM for fees is INSUFFICIENT_XLM", () => {
  assert.equal(
    toPayLoopError(new Error("tx_insufficient_balance")).code,
    "INSUFFICIENT_XLM",
  );
  assert.equal(
    submissionError(resultXdr("txInsufficientBalance"), "abc").code,
    "INSUFFICIENT_XLM",
  );
  assert.equal(
    submissionError(resultXdr("txInsufficientFee"), "abc").code,
    "INSUFFICIENT_XLM",
  );
});

test("an unfunded account is ACCOUNT_NOT_FOUND", () => {
  const err = toPayLoopError(new Error("Account not found: GABC"));
  assert.equal(err.code, "ACCOUNT_NOT_FOUND");
  assert.match(err.message, /XLM/);
});

test("a missing trustline is TRUSTLINE_MISSING", () => {
  const err = toPayLoopError(
    new Error("HostError: trustline entry is missing for account"),
  );
  assert.equal(err.code, "TRUSTLINE_MISSING");
});

// ── network and submission ──────────────────────────────────────────────────

test("an unreachable network is NETWORK and says nothing was sent", () => {
  const err = toPayLoopError(new TypeError("Failed to fetch"));
  assert.equal(err.code, "NETWORK");
  assert.match(err.message, /nothing was sent/i);
});

test("a rejected submission carries the hash and is not an unknown outcome", () => {
  const err = submissionError(resultXdr("txBadSeq"), "abc123");
  assert.equal(err.code, "SUBMIT_REJECTED");
  assert.equal(err.txHash, "abc123");
  assert.equal(isOutcomeUnknown(err), false);
});

// ── timeout vs failure ──────────────────────────────────────────────────────

test("a timeout never claims the transaction failed", () => {
  const err = timeoutError("deadbeef");
  assert.equal(err.code, "TIMEOUT");
  assert.equal(err.txHash, "deadbeef");
  assert.equal(isOutcomeUnknown(err), true);
  assert.doesNotMatch(err.message, /fail|didn't succeed|unsuccessful/i);
  assert.match(err.message, /explorer/i);
});

test("an on-chain failure is TX_FAILED, with the hash, and differs from a timeout", () => {
  const failed = failedTransactionError(resultXdr("txFailed"), "ff00");
  assert.equal(failed.code, "TX_FAILED");
  assert.equal(failed.txHash, "ff00");
  assert.equal(isOutcomeUnknown(failed), false);
  assert.notEqual(failed.message, timeoutError("ff00").message);
});

test("a failed transaction that ran out of fee money says so", () => {
  assert.equal(
    failedTransactionError(resultXdr("txInsufficientBalance"), "aa").code,
    "INSUFFICIENT_XLM",
  );
});

// ── general behaviour ───────────────────────────────────────────────────────

test("every code has a non-empty, distinct message", () => {
  const entries = Object.entries(ERROR_MESSAGES);
  for (const [code, message] of entries) {
    assert.ok(message.length > 10, code);
  }
  assert.equal(new Set(entries.map(([, m]) => m)).size, entries.length);
});

test("a PayLoopError passes through unchanged", () => {
  const original = new PayLoopError("ALREADY_PAID", { txHash: "x" });
  assert.equal(toPayLoopError(original), original);
});

test("unrecognised input gets the generic message, not its raw text", () => {
  const err = toPayLoopError(new Error("xdr_decode: unexpected byte 0x7f"));
  assert.equal(err.code, "UNKNOWN");
  assert.equal(err.message, ERROR_MESSAGES.UNKNOWN);
  assert.match(String(err.cause.message), /xdr_decode/);
  for (const v of [undefined, null, "", 0, {}, []]) {
    assert.equal(toPayLoopError(v).code, "UNKNOWN");
  }
});

test("txResultName reads the result code and tolerates other values", () => {
  assert.equal(txResultName(resultXdr("txFailed")), "txFailed");
  assert.equal(txResultName(null), null);
  assert.equal(txResultName({}), null);
  assert.equal(txResultName("nope"), null);
});

test("describeError flags only unconfirmed transactions", () => {
  const timeout = describeError(timeoutError("h1"));
  assert.deepEqual(
    { u: timeout.unconfirmed, h: timeout.txHash },
    { u: true, h: "h1" },
  );
  const rejected = describeError({ code: -4, message: "rejected" });
  assert.deepEqual(
    { u: rejected.unconfirmed, h: rejected.txHash },
    { u: false, h: null },
  );
});
