import test from "node:test";
import assert from "node:assert/strict";
import { configErrors, isConfigured, validateConfig } from "../config.ts";

test("default configuration is valid", () => {
  assert.deepEqual(validateConfig({}), []);
  assert.deepEqual(configErrors, []);
  assert.equal(isConfigured(), true);
});

test("rejects invalid contract and token StrKey IDs", () => {
  const errors = validateConfig({
    NEXT_PUBLIC_CONTRACT_ID: "not-a-contract",
    NEXT_PUBLIC_TOKEN_ID:
      "GDYPHJ7H2DO6OUWD5ZJRLFT57QNUZYOWBBYEHEQBAGJDFBAAFJWMXSNU",
  });
  assert.equal(errors.length, 2);
  assert.match(errors[0], /NEXT_PUBLIC_CONTRACT_ID/);
  assert.match(errors[1], /NEXT_PUBLIC_TOKEN_ID/);
});

test("rejects invalid token decimals (NaN, empty, negative, float, > 18)", () => {
  for (const bad of ["abc", "", "   ", "-1", "7.5", "19"]) {
    const errors = validateConfig({ NEXT_PUBLIC_TOKEN_DECIMALS: bad });
    assert.equal(errors.length, 1, `expected error for decimals "${bad}"`);
    assert.match(errors[0], /NEXT_PUBLIC_TOKEN_DECIMALS/);
  }

  for (const good of ["0", "7", "18"]) {
    assert.deepEqual(
      validateConfig({ NEXT_PUBLIC_TOKEN_DECIMALS: good }),
      [],
      `expected valid for decimals "${good}"`,
    );
  }
});

test("rejects invalid RPC and Horizon URLs", () => {
  const errors = validateConfig({
    NEXT_PUBLIC_RPC_URL: "not-a-url",
    NEXT_PUBLIC_HORIZON_URL: "ftp://example.com",
  });
  assert.equal(errors.length, 2);
  assert.match(errors[0], /NEXT_PUBLIC_RPC_URL/);
  assert.match(errors[1], /NEXT_PUBLIC_HORIZON_URL/);
});

test("rejects invalid read source public key", () => {
  const errors = validateConfig({
    NEXT_PUBLIC_READ_SOURCE:
      "CAQVSBNVL7OI66IDTYCR7XL4VJKMSOYGBW5D6SWLTWTINTCQO2OGCSXS",
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /NEXT_PUBLIC_READ_SOURCE/);
});

test("validates NEXT_PUBLIC_TOKENS entries when provided", () => {
  const invalidJson = validateConfig({ NEXT_PUBLIC_TOKENS: "{bad" });
  assert.equal(invalidJson.length, 1);
  assert.match(invalidJson[0], /NEXT_PUBLIC_TOKENS/);

  const invalidEntry = validateConfig({
    NEXT_PUBLIC_TOKENS: JSON.stringify([
      { id: "bad-id", issuer: "bad-issuer", symbol: "TST", decimals: 99 },
    ]),
  });
  assert.equal(invalidEntry.length, 3);
  assert.match(invalidEntry[0], /NEXT_PUBLIC_TOKENS\[0\]\.id/);
  assert.match(invalidEntry[1], /NEXT_PUBLIC_TOKENS\[0\]\.issuer/);
  assert.match(invalidEntry[2], /NEXT_PUBLIC_TOKENS\[0\]\.decimals/);
});
