import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  HEALTH_CACHE_CONTROL,
  evaluateContractVersion,
  evaluateLedger,
  runHealthChecks,
} from "../health.ts";

test("ledger check requires a positive integer sequence", () => {
  assert.deepEqual(evaluateLedger({ sequence: 12345, protocolVersion: "22" }), {
    ok: true,
    sequence: 12345,
    protocolVersion: "22",
  });
  assert.deepEqual(evaluateLedger({ sequence: 0 }), { ok: false });
  assert.deepEqual(evaluateLedger({ sequence: "123" }), { ok: false });
  assert.deepEqual(evaluateLedger(null), { ok: false });
});

test("contract check accepts any non-empty version", () => {
  assert.deepEqual(evaluateContractVersion("v1"), { ok: true, version: "v1" });
  assert.deepEqual(evaluateContractVersion(""), { ok: false });
  assert.deepEqual(evaluateContractVersion(null), { ok: false });
});

test("both checks succeed -> 200 healthy", async () => {
  const result = await runHealthChecks({
    getLatestLedger: async () => ({ sequence: 123, protocolVersion: "22" }),
    simulateVersion: async () => "v1",
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    status: "healthy",
    checks: {
      ledger: { ok: true, sequence: 123, protocolVersion: "22" },
      contract: { ok: true, version: "v1" },
    },
  });
});

test("one failed dependency -> 503 degraded but the other check still runs", async () => {
  let contractCalls = 0;
  const result = await runHealthChecks({
    getLatestLedger: async () => {
      throw new Error("http://rpc.internal failed with S-SECRET");
    },
    simulateVersion: async () => {
      contractCalls += 1;
      return "v1";
    },
  });

  assert.equal(contractCalls, 1);
  assert.equal(result.status, 503);
  assert.equal(result.body.status, "degraded");
  assert.deepEqual(result.body.checks.ledger, { ok: false });
  assert.deepEqual(result.body.checks.contract, { ok: true, version: "v1" });
  assert.equal(JSON.stringify(result).includes("S-SECRET"), false);
  assert.equal(JSON.stringify(result).includes("rpc.internal"), false);
});

test("both failed dependencies -> 503 with both checks false", async () => {
  const result = await runHealthChecks({
    getLatestLedger: async () => {
      throw new Error("ledger down");
    },
    simulateVersion: async () => {
      throw new Error("contract down");
    },
  });

  assert.equal(result.status, 503);
  assert.deepEqual(result.body.checks, {
    ledger: { ok: false },
    contract: { ok: false },
  });
});

test("the health route is dynamic, no-store and secret-free", () => {
  const routePath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "app",
    "api",
    "health",
    "route.ts",
  );
  const source = readFileSync(routePath, "utf8");
  assert.equal(HEALTH_CACHE_CONTROL, "no-store");
  assert.match(source, /export const dynamic = "force-dynamic"/);
  assert.match(source, /checkPayloopHealth/);
  assert.match(source, /Cache-Control/);
  assert.doesNotMatch(source, /USDC_ISSUER_SECRET/);
});
