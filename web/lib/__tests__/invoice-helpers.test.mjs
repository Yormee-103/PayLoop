import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCreateInvoiceUrl,
  buildReminderMessage,
  dueDateError,
  invoicePrintTitle,
  isInvoiceOwner,
  isOverdue,
  parseTokenBalance,
  isValidInvoiceId,
  todayDateInputValue,
} from "../invoice-helpers.ts";

test("duplicate invoice URLs encode client, amount and description", () => {
  assert.equal(
    buildCreateInvoiceUrl({
      client: "GCLIENT",
      amount: "100.5",
      description: "Design & build",
    }),
    "/create?client=GCLIENT&amount=100.5&description=Design+%26+build"
  );
});

// ── #66 due date ────────────────────────────────────────────────────────────

test("todayDateInputValue formats the local date with zero padding", () => {
  assert.equal(todayDateInputValue(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
  assert.equal(todayDateInputValue(new Date(2026, 10, 22, 0, 0)), "2026-11-22");
});

test("an empty due date is allowed", () => {
  assert.equal(dueDateError("", "2026-11-22"), null);
});

test("today and future due dates are allowed", () => {
  assert.equal(dueDateError("2026-11-22", "2026-11-22"), null);
  assert.equal(dueDateError("2026-11-23", "2026-11-22"), null);
  assert.equal(dueDateError("2027-01-01", "2026-11-22"), null);
});

test("past due dates are rejected with a clear message", () => {
  assert.match(dueDateError("2026-11-21", "2026-11-22") ?? "", /can't be in the past/);
  assert.match(dueDateError("2025-12-31", "2026-11-22") ?? "", /can't be in the past/);
});

test("comparison is correct across month and year boundaries", () => {
  assert.notEqual(dueDateError("2026-10-31", "2026-11-01"), null);
  assert.equal(dueDateError("2027-01-01", "2026-12-31"), null);
  assert.notEqual(dueDateError("2026-12-31", "2027-01-01"), null);
});

test("a malformed date is rejected", () => {
  assert.equal(dueDateError("22/11/2026", "2026-11-22"), "Enter a valid due date.");
});

// ── #67 filename ────────────────────────────────────────────────────────────

test("unpaid invoices are titled PayLoop-Invoice-<id>", () => {
  assert.equal(invoicePrintTitle({ id: "42", status: "Pending" }), "PayLoop-Invoice-42");
});

test("paid invoices are titled PayLoop-Receipt-<id>", () => {
  assert.equal(invoicePrintTitle({ id: "42", status: "Paid" }), "PayLoop-Receipt-42");
});

test("the preview placeholder id and unsafe characters never reach the filename", () => {
  assert.equal(invoicePrintTitle({ id: "—", status: "Pending" }), "PayLoop-Invoice");
  assert.equal(invoicePrintTitle({ id: "4/2:*", status: "Pending" }), "PayLoop-Invoice-42");
});

// ── #69 owner detection ─────────────────────────────────────────────────────

const inv = { freelancer: "GFREELANCER", client: "GCLIENT" };

test("the freelancer is detected as the owner", () => {
  assert.equal(isInvoiceOwner("GFREELANCER", inv), true);
});

test("the client, a stranger and a disconnected wallet are not owners", () => {
  assert.equal(isInvoiceOwner("GCLIENT", inv), false);
  assert.equal(isInvoiceOwner("GOTHER", inv), false);
  assert.equal(isInvoiceOwner(null, inv), false);
  assert.equal(isInvoiceOwner(undefined, inv), false);
  assert.equal(isInvoiceOwner("", inv), false);
});

test("an address that is both freelancer and client keeps the client (pay) view", () => {
  assert.equal(isInvoiceOwner("GSAME", { freelancer: "GSAME", client: "GSAME" }), false);
});

test("reminder message includes id, amount, description and link", () => {
  const msg = buildReminderMessage({
    id: "7",
    amountLabel: "10 USDC",
    description: "Logo design",
    url: "https://x.test/pay/7",
  });
  assert.match(msg, /invoice #7 for 10 USDC \(Logo design\)/);
  assert.match(msg, /https:\/\/x\.test\/pay\/7$/);
  assert.match(
    buildReminderMessage({ id: "7", amountLabel: "1 USDC", description: "", url: "u" }),
    /\(no description\)/
  );
});

// ── #70 overdue ─────────────────────────────────────────────────────────────

const NOW_MS = Date.UTC(2026, 10, 22, 12, 0, 0);
const NOW_S = BigInt(Math.floor(NOW_MS / 1000));

test("a Pending invoice past its due date is overdue", () => {
  assert.equal(isOverdue({ status: "Pending", dueDate: NOW_S - 1n }, NOW_MS), true);
  assert.equal(isOverdue({ status: "Pending", dueDate: NOW_S - 86_400n }, NOW_MS), true);
});

test("a Pending invoice due now or later is not overdue", () => {
  assert.equal(isOverdue({ status: "Pending", dueDate: NOW_S }, NOW_MS), false);
  assert.equal(isOverdue({ status: "Pending", dueDate: NOW_S + 1n }, NOW_MS), false);
});

test("a Paid invoice is never overdue", () => {
  assert.equal(isOverdue({ status: "Paid", dueDate: NOW_S - 86_400n }, NOW_MS), false);
});

test("an invoice with no due date is never overdue", () => {
  assert.equal(isOverdue({ status: "Pending", dueDate: 0n }, NOW_MS), false);
});

test("isOverdue defaults to the current clock", () => {
  assert.equal(isOverdue({ status: "Pending", dueDate: 1n }), true);
  assert.equal(isOverdue({ status: "Pending", dueDate: 99_999_999_999n }), false);
});


test("parseTokenBalance keeps a genuine zero and parses amounts", () => {
  assert.equal(parseTokenBalance(0n), 0n);
  assert.equal(parseTokenBalance("0"), 0n);
  assert.equal(parseTokenBalance(12345678901234567890n), 12345678901234567890n);
});

test("parseTokenBalance throws instead of returning 0 for a missing value", () => {
  assert.throws(() => parseTokenBalance(null));
  assert.throws(() => parseTokenBalance(undefined));
test("isValidInvoiceId accepts digit-only ids up to u64::MAX", () => {
  assert.equal(isValidInvoiceId("1"), true);
  assert.equal(isValidInvoiceId("0"), true);
  assert.equal(isValidInvoiceId("18446744073709551615"), true);
});

test("isValidInvoiceId rejects non-numeric, negative, decimal and oversized ids", () => {
  for (const id of ["", "abc", "1.5", "-1", "+1", " 1", "1e3", "0x10", "18446744073709551616", "99999999999999999999999"]) {
    assert.equal(isValidInvoiceId(id), false, id);
  }
});
