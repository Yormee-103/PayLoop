import test from "node:test";
import assert from "node:assert/strict";
import {
  averageTimeToPayDays,
  bucketMonthlyIncome,
  bucketSettledVolume,
  overdueTotalsByToken,
} from "../stats.ts";

function invoice(fields) {
  return {
    id: "1",
    freelancer: "GFREE",
    client: "GCLIENT",
    token: "GTOKEN",
    amount: 0n,
    description: "",
    dueDate: 0n,
    status: "Pending",
    createdAt: 0n,
    paidAt: 0n,
    ...fields,
  };
}

function paidAt(iso, amount = 1_0000000n, token = "GTOKEN") {
  return invoice({
    status: "Paid",
    amount,
    token,
    paidAt: BigInt(Date.parse(iso) / 1000),
  });
}

test("bucketSettledVolume groups nearby paid invoices into day buckets", () => {
  const result = bucketSettledVolume([
    paidAt("2026-01-05T10:00:00Z", 2n),
    paidAt("2026-01-05T18:00:00Z", 3n),
    paidAt("2026-01-06T09:00:00Z", 4n, "GOTHER"),
  ]);

  assert.equal(result.granularity, "day");
  assert.deepEqual(
    result.buckets.map((b) => [b.key, b.amount, b.tokenId]),
    [
      ["2026-01-05:GTOKEN", 5n, "GTOKEN"],
      ["2026-01-06:GOTHER", 4n, "GOTHER"],
    ]
  );
});

test("bucketSettledVolume switches to Monday-start week buckets after three weeks", () => {
  const result = bucketSettledVolume([
    paidAt("2024-01-01T12:00:00Z", 2n), // Monday
    paidAt("2024-01-31T12:00:00Z", 3n), // Wednesday of the Jan 29 week
  ]);

  assert.equal(result.granularity, "week");
  assert.deepEqual(
    result.buckets.map((b) => [b.key, b.amount]),
    [
      ["2024-01-01:GTOKEN", 2n],
      ["2024-01-29:GTOKEN", 3n],
    ]
  );
});

test("bucketMonthlyIncome groups paid invoices by UTC month and token", () => {
  const result = bucketMonthlyIncome([
    paidAt("2026-01-31T23:00:00Z", 2n),
    paidAt("2026-02-01T00:30:00Z", 3n, "GOTHER"),
    paidAt("2026-02-01T12:00:00Z", 4n),
  ]);

  assert.equal(result.granularity, "month");
  assert.deepEqual(
    result.buckets.map((b) => [b.key, b.amount, b.tokenId]),
    [
      ["2026-01-01:GTOKEN", 2n, "GTOKEN"],
      ["2026-02-01:GOTHER", 3n, "GOTHER"],
      ["2026-02-01:GTOKEN", 4n, "GTOKEN"],
    ]
  );
});

test("averageTimeToPayDays averages only valid paid intervals", () => {
  const day = 86_400n;
  const average = averageTimeToPayDays([
    invoice({
      status: "Paid",
      createdAt: 1_000n,
      paidAt: 1_000n + 2n * day,
    }),
    invoice({
      status: "Paid",
      createdAt: 2_000n,
      paidAt: 2_000n + 4n * day,
    }),
    invoice({ status: "Pending", createdAt: 3_000n, paidAt: 0n }),
    invoice({
      status: "Paid",
      createdAt: 0n,
      paidAt: 4_000n,
    }),
  ]);

  assert.equal(average, 3);
  assert.equal(averageTimeToPayDays([]), null);
});

test("overdueTotalsByToken sums overdue amounts without mixing tokens", () => {
  const nowMs = Date.UTC(2026, 10, 24, 12, 0, 0);
  const dueYesterday = BigInt(Math.floor(nowMs / 1000) - 86_400);
  const totals = overdueTotalsByToken(
    [
      invoice({
        status: "Pending",
        dueDate: dueYesterday,
        amount: 5n,
        token: "GTOKEN",
      }),
      invoice({
        status: "Pending",
        dueDate: dueYesterday,
        amount: 7n,
        token: "GOTHER",
      }),
      invoice({
        status: "Paid",
        dueDate: dueYesterday,
        amount: 11n,
        token: "GTOKEN",
      }),
      invoice({
        status: "Pending",
        dueDate: 0n,
        amount: 13n,
        token: "GTOKEN",
      }),
    ],
    nowMs
  );

  assert.deepEqual([...totals.entries()], [
    ["GTOKEN", 5n],
    ["GOTHER", 7n],
  ]);
});
