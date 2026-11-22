import { describe, expect, it } from "vitest";
import {
  mapErrorMessage,
  PayLoopError,
  CONTRACT_ERROR_MESSAGES,
} from "./errors";

describe("Error Mapping & Plain Language Translation", () => {
  it("translates all contract error codes (1-8) to distinct plain language", () => {
    for (let code = 1; code <= 8; code++) {
      const rawError1 = `HostError: Error(Contract, #${code})`;
      const rawError2 = `Error(Contract, ${code})`;
      const expected = CONTRACT_ERROR_MESSAGES[code];

      expect(mapErrorMessage(rawError1)).toBe(expected);
      expect(mapErrorMessage(rawError2)).toBe(expected);
    }
  });

  it("handles timeout without claiming the transaction failed", () => {
    const rawTimeout = "Transaction did not succeed (status: NOT_FOUND).";
    const mapped = mapErrorMessage(rawTimeout, "abc123hash");

    expect(mapped).toContain("Transaction confirmation timed out");
    expect(mapped).toContain("abc123hash");
    expect(mapped).toContain("Check the explorer before retrying");
    expect(mapped).not.toContain("failed");
  });

  it("translates user-rejected signing in wallet", () => {
    const raw = "User declined access to wallet signature.";
    expect(mapErrorMessage(raw)).toContain("Transaction was cancelled");
    expect(mapErrorMessage(raw)).toContain("rejected in your wallet");
  });

  it("translates insufficient XLM fee errors", () => {
    const raw = "Transaction submission failed: tx_insufficient_balance";
    expect(mapErrorMessage(raw)).toContain("Insufficient XLM in your wallet");
  });

  it("translates missing trustline errors", () => {
    const raw = "op_no_trust: trustline entry is missing";
    expect(mapErrorMessage(raw)).toContain("Missing token trustline");
  });

  it("returns PayLoopError message directly if typed error is thrown", () => {
    const err = new PayLoopError("Custom payloop failure", { code: 400 });
    expect(mapErrorMessage(err)).toBe("Custom payloop failure");
  });
});
