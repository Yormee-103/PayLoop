import { describe, expect, it } from "vitest";
import { validateClientAddress } from "./address";

describe("Client Address Validation (Issue #11)", () => {
  const validKey1 = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
  const validKey2 = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
  const ownKey = validKey1;

  it("accepts valid Ed25519 public keys", () => {
    const res1 = validateClientAddress(validKey1);
    expect(res1.valid).toBe(true);
    if (res1.valid) {
      expect(res1.address).toBe(validKey1);
    }

    const res2 = validateClientAddress(validKey2);
    expect(res2.valid).toBe(true);
  });

  it("trims whitespace from valid keys", () => {
    const res = validateClientAddress(`  ${validKey1}  \n`);
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.address).toBe(validKey1);
    }
  });

  it("rejects a one-character typo in an otherwise valid address (checksum error)", () => {
    // Replace the final character '5' with '6' (same length and G-prefix, but bad checksum)
    const typoKey = validKey1.slice(0, -1) + "6";
    const res = validateClientAddress(typoKey);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.kind).toBe("invalid_checksum");
      expect(res.error).toBe(
        "Invalid Stellar address checksum. Please check for mistyped characters."
      );
    }

    // Replace a middle character
    const typoMiddle =
      validKey1.slice(0, 20) + "X" + validKey1.slice(21);
    const resMiddle = validateClientAddress(typoMiddle);
    expect(resMiddle.valid).toBe(false);
    if (!resMiddle.valid) {
      expect(resMiddle.kind).toBe("invalid_checksum");
    }
  });

  it("rejects contract addresses (C...) with a specific message", () => {
    const contractAddr =
      "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
    const res = validateClientAddress(contractAddr);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.kind).toBe("contract");
      expect(res.error).toContain("Contract addresses (starting with C) cannot be used");
    }
  });

  it("rejects muxed addresses (M...) with a specific message", () => {
    const muxedAddr =
      "MAQAA5L7T6IWVO6OUAWIBG3LBNCBZMTYN3XHNPFD7Ga7W346Q36AAAAAAAAAAAACMNQ";
    const res = validateClientAddress(muxedAddr);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.kind).toBe("muxed");
      expect(res.error).toContain("Muxed addresses (starting with M) are not supported");
    }
  });

  it("rejects malformed addresses with incorrect prefix or length", () => {
    const shortKey = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH";
    const resShort = validateClientAddress(shortKey);
    expect(resShort.valid).toBe(false);
    if (!resShort.valid) {
      expect(resShort.kind).toBe("malformed");
      expect(resShort.error).toContain("must start with 'G' and be 56 characters long");
    }

    const nonGKey = "ABBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
    const resNonG = validateClientAddress(nonGKey);
    expect(resNonG.valid).toBe(false);
    if (!resNonG.valid) {
      expect(resNonG.kind).toBe("malformed");
    }
  });

  it("rejects empty or whitespace inputs", () => {
    expect(validateClientAddress("").valid).toBe(false);
    expect(validateClientAddress("   ").valid).toBe(false);
    expect(validateClientAddress(null).valid).toBe(false);
    expect(validateClientAddress(undefined).valid).toBe(false);
  });

  it("rejects invoicing own address when ownAddress is provided", () => {
    const res = validateClientAddress(ownKey, ownKey);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.kind).toBe("self");
      expect(res.error).toBe("The client can't be your own address.");
    }
  });
});
