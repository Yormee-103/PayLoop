import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  FAUCET_MESSAGES,
  checkFaucetTrustline,
  handleFaucetRequest,
  isAccountAddress,
  mapSendStatus,
} from "../faucet.ts";
import { config } from "../config.ts";

const ACCOUNT = "GBWIY4AIYCX7CFMSR2D3DE2TW6N5RIMXQIU7QT6S44UEOQZINAFYT463";

function deps(overrides = {}) {
  return {
    checkLimit: async () => null,
    recordMint: async () => {},
    checkTrustline: async () => "present",
    mint: async () => ({ kind: "confirmed", hash: "abc123" }),
    ...overrides,
  };
}

test("faucet accepts only G... account addresses", () => {
  assert.equal(isAccountAddress(ACCOUNT), true);
  assert.equal(isAccountAddress(config.contractId), false); // C... contract
  assert.equal(isAccountAddress("not-an-address"), false);
  assert.equal(isAccountAddress(undefined), false);
});

test("trustline check distinguishes present, missing and unavailable", async () => {
  const balances = [
    {
      asset_type: "credit_alphanum4",
      asset_code: config.tokenSymbol,
      asset_issuer: config.tokenIssuer,
    },
  ];
  const params = {
    issuer: config.tokenIssuer,
    symbol: config.tokenSymbol,
    horizonUrl: config.horizonUrl,
  };

  assert.equal(
    await checkFaucetTrustline(ACCOUNT, {
      ...params,
      loadAccount: async () => ({ balances }),
    }),
    "present",
  );
  assert.equal(
    await checkFaucetTrustline(ACCOUNT, {
      ...params,
      loadAccount: async () => ({ balances: [] }),
    }),
    "missing",
  );
  assert.equal(
    await checkFaucetTrustline(ACCOUNT, {
      ...params,
      loadAccount: async () => {
        throw Object.assign(new Error("not found"), {
          response: { status: 404 },
        });
      },
    }),
    "missing",
  );
  assert.equal(
    await checkFaucetTrustline(ACCOUNT, {
      ...params,
      loadAccount: async () => {
        throw new Error("connect ETIMEDOUT http://rpc.internal");
      },
    }),
    "unavailable",
  );
});

test("send statuses map explicitly, including DUPLICATE and TRY_AGAIN_LATER", () => {
  assert.equal(mapSendStatus("PENDING"), "poll");
  assert.equal(mapSendStatus("DUPLICATE"), "poll-duplicate");
  assert.equal(mapSendStatus("TRY_AGAIN_LATER"), "busy");
  assert.equal(mapSendStatus("ERROR"), "rejected");
  assert.equal(mapSendStatus("SOMETHING_NEW"), "unknown");
});

test("contract addresses are rejected before any dependency is called", async () => {
  const calls = [];
  const result = await handleFaucetRequest({
    address: config.contractId,
    ip: "1.2.3.4",
    deps: deps({
      checkLimit: async () => {
        calls.push("limit");
        return null;
      },
    }),
  });

  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { error: FAUCET_MESSAGES.invalidAddress });
  assert.deepEqual(calls, []);
});

test("a missing trustline returns 409 without minting", async () => {
  let minted = false;
  const result = await handleFaucetRequest({
    address: ACCOUNT,
    ip: "1.2.3.4",
    deps: deps({
      checkTrustline: async () => "missing",
      mint: async () => {
        minted = true;
        return { kind: "confirmed", hash: "x" };
      },
    }),
  });

  assert.equal(result.status, 409);
  assert.equal(result.body.error, FAUCET_MESSAGES.trustlineMissing);
  assert.equal(minted, false);
});

test("Horizon failure returns 502 rather than telling the user to add a trustline", async () => {
  const result = await handleFaucetRequest({
    address: ACCOUNT,
    ip: "1.2.3.4",
    deps: deps({ checkTrustline: async () => "unavailable" }),
  });

  assert.equal(result.status, 502);
  assert.equal(result.body.error, FAUCET_MESSAGES.trustlineUnavailable);
});

test("rate limiting still wins before the trustline check", async () => {
  const calls = [];
  const result = await handleFaucetRequest({
    address: ACCOUNT,
    ip: "1.2.3.4",
    deps: deps({
      checkLimit: async () => {
        calls.push("limit");
        return 120;
      },
      checkTrustline: async () => {
        calls.push("trustline");
        return "present";
      },
    }),
  });

  assert.equal(result.status, 429);
  assert.equal(result.headers["Retry-After"], "120");
  assert.deepEqual(calls, ["limit"]);
});

test("TRY_AGAIN_LATER returns an immediate 503 with Retry-After", async () => {
  const result = await handleFaucetRequest({
    address: ACCOUNT,
    ip: "1.2.3.4",
    deps: deps({ mint: async () => ({ kind: "busy" }) }),
  });

  assert.equal(result.status, 503);
  assert.equal(result.body.error, FAUCET_MESSAGES.networkBusy);
  assert.equal(result.headers["Retry-After"], "5");
});

test("a confirmed duplicate is treated as success and recorded once", async () => {
  let recorded = 0;
  const result = await handleFaucetRequest({
    address: ACCOUNT,
    ip: "1.2.3.4",
    deps: deps({
      mint: async () => ({
        kind: "duplicate-confirmed",
        hash: "duplicate-hash",
      }),
      recordMint: async () => {
        recorded += 1;
      },
    }),
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true, hash: "duplicate-hash" });
  assert.equal(recorded, 1);
});

test("an unconfirmed duplicate is a 409 with safe guidance", async () => {
  const result = await handleFaucetRequest({
    address: ACCOUNT,
    ip: "1.2.3.4",
    deps: deps({
      mint: async () => ({ kind: "duplicate-pending", hash: "d" }),
    }),
  });

  assert.equal(result.status, 409);
  assert.equal(result.body.error, FAUCET_MESSAGES.duplicatePending);
});

test("ERROR and unknown send outcomes are safe 502s", async () => {
  const rejected = await handleFaucetRequest({
    address: ACCOUNT,
    ip: "1.2.3.4",
    deps: deps({ mint: async () => ({ kind: "rejected" }) }),
  });
  assert.equal(rejected.status, 502);
  assert.equal(rejected.body.error, FAUCET_MESSAGES.rejected);

  const failed = await handleFaucetRequest({
    address: ACCOUNT,
    ip: "1.2.3.4",
    deps: deps({ mint: async () => ({ kind: "failed" }) }),
  });
  assert.equal(failed.status, 500);
  assert.equal(failed.body.error, FAUCET_MESSAGES.unexpected);
});

test("unexpected failures never leak internal details", async () => {
  const secret = "S-SECRET-https://rpc.internal";
  const original = console.error;
  console.error = () => {};
  try {
    const result = await handleFaucetRequest({
      address: ACCOUNT,
      ip: "1.2.3.4",
      deps: deps({
        mint: async () => {
          throw new Error(`prepare failed for ${secret}`);
        },
      }),
    });

    assert.equal(result.status, 500);
    assert.deepEqual(result.body, { error: FAUCET_MESSAGES.unexpected });
    assert.equal(JSON.stringify(result).includes(secret), false);
  } finally {
    console.error = original;
  }
});

test("the route delegates to the hardened helper and no longer echoes errors", () => {
  const routePath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "app",
    "api",
    "faucet",
    "route.ts",
  );
  const source = readFileSync(routePath, "utf8");
  assert.match(source, /handleFaucetRequest/);
  assert.match(source, /checkFaucetTrustline/);
  assert.match(source, /submitMint/);
  assert.doesNotMatch(source, /errorMessage/);
});
