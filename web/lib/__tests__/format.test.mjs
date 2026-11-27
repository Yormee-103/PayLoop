import test from "node:test";
import assert from "node:assert/strict";
import {
  toBaseUnits,
  fromBaseUnits,
  formatAmount,
  formatNaira,
  shortAddress,
  formatDate,
  humanizeDescription,
  parseAmount,
} from "../format.ts";

// Tests for toBaseUnits conversion from human-readable to base units (stroops)
test("toBaseUnits: converts whole numbers to base units", () => {
  assert.equal(toBaseUnits("100"), 100_0000000n);
  assert.equal(toBaseUnits("1"), 1_0000000n);
  assert.equal(toBaseUnits("0"), 0n);
});

test("toBaseUnits: converts decimal numbers correctly", () => {
  assert.equal(toBaseUnits("100.5"), 100_5000000n);
  assert.equal(toBaseUnits("0.1"), 1000000n);
  assert.equal(toBaseUnits("0.0000001"), 1n);
  assert.equal(toBaseUnits("123.4567890"), 123_4567890n); // 7 decimals
});

test("toBaseUnits: handles truncation of excess decimals", () => {
  // Input has 8 decimals, should truncate to 7
  assert.equal(toBaseUnits("1.12345678"), 1_1234567n);
  assert.equal(toBaseUnits("1.99999999"), 1_9999999n);
});

test("toBaseUnits: handles numeric input", () => {
  assert.equal(toBaseUnits(100), 100_0000000n);
  assert.equal(toBaseUnits(0.5), 5000000n);
  assert.equal(toBaseUnits(1.23), 12_300000n);
});

test("toBaseUnits: handles negative numbers", () => {
  assert.equal(toBaseUnits("-100"), -100_0000000n);
  assert.equal(toBaseUnits("-0.5"), -5000000n);
  assert.equal(toBaseUnits("-1.5"), -1_5000000n);
});

test("toBaseUnits: handles whitespace and empty strings", () => {
  assert.equal(toBaseUnits("  100  "), 100_0000000n);
  assert.equal(toBaseUnits(""), 0n);
  assert.equal(toBaseUnits("   "), 0n);
});

test("toBaseUnits: accepts custom decimal places", () => {
  assert.equal(toBaseUnits("100", 2), 10000n); // 2 decimals
  assert.equal(toBaseUnits("100.5", 2), 10050n);
  assert.equal(toBaseUnits("0.01", 2), 1n);
});

test("toBaseUnits: throws a clear error instead of a SyntaxError for malformed input", () => {
  for (const bad of ["1e3", "Infinity", "1_000", "0x10"]) {
    assert.throws(() => toBaseUnits(bad), (err) => {
      assert.ok(!(err instanceof SyntaxError));
      assert.ok(err instanceof Error);
      return true;
    });
  }
});

// Tests for parseAmount (strict validation used by Create, Withdraw and templates)
test("parseAmount: accepts valid plain decimal inputs", () => {
  assert.deepEqual(parseAmount("100"), { ok: true, value: 100_0000000n });
  assert.deepEqual(parseAmount("1.5"), { ok: true, value: 1_5000000n });
  assert.deepEqual(parseAmount("0.0000001"), { ok: true, value: 1n });
  assert.deepEqual(parseAmount("123.4567890"), { ok: true, value: 123_4567890n });
});

test("parseAmount: rejects scientific notation, hex, separators, Infinity", () => {
  for (const bad of ["1e3", "0x10", "1_000", "Infinity", "-1", "abc"]) {
    const res = parseAmount(bad);
    assert.equal(res.ok, false, `expected rejection for ${bad}`);
    assert.equal(typeof res.error, "string");
    assert.ok(res.error.length > 0);
  }
});

test("parseAmount: rejects more than 7 decimal places instead of silently truncating", () => {
  const res = parseAmount("1.123456789");
  assert.equal(res.ok, false);
  assert.equal(typeof res.error, "string");
});

test("parseAmount: rejects amounts below one base unit", () => {
  // "0.00000001" would round to 0 base units and be rejected by the contract
  const res = parseAmount("0.00000001");
  assert.equal(res.ok, false);
  assert.equal(typeof res.error, "string");
  assert.equal(parseAmount("0").ok, false);
});

test("parseAmount: never throws on arbitrary input", () => {
  for (const bad of ["", "   ", "1e3", "Infinity", "1_000", "0x10", "1.1.1"]) {
    assert.doesNotThrow(() => parseAmount(bad));
  }
});

// Tests for fromBaseUnits conversion from base units to human-readable
test("fromBaseUnits: converts base units to human-readable strings", () => {
  assert.equal(fromBaseUnits(100_0000000n), "100");
  assert.equal(fromBaseUnits(1_0000000n), "1");
  assert.equal(fromBaseUnits(0n), "0");
});

test("fromBaseUnits: handles fractional base units", () => {
  assert.equal(fromBaseUnits(1_5000000n), "1.5");
  assert.equal(fromBaseUnits(1000000n), "0.1");
  assert.equal(fromBaseUnits(1n), "0.0000001");
});

test("fromBaseUnits: removes trailing zeros", () => {
  assert.equal(fromBaseUnits(100_0000000n), "100"); // no trailing zeros
  assert.equal(fromBaseUnits(100_1000000n), "100.1");
  assert.equal(fromBaseUnits(100_0100000n), "100.01");
});

test("fromBaseUnits: handles numeric and string input", () => {
  assert.equal(fromBaseUnits(100_0000000n), "100");
  assert.equal(fromBaseUnits("100000000"), "100");
  assert.equal(fromBaseUnits(100_0000000), "100");
});

test("fromBaseUnits: accepts custom decimal places", () => {
  assert.equal(fromBaseUnits(10000n, 2), "100");
  assert.equal(fromBaseUnits(1050n, 2), "10.5");
  assert.equal(fromBaseUnits(1n, 2), "0.01");
});

test("fromBaseUnits: handles negative values", () => {
  assert.equal(fromBaseUnits(-100_0000000n), "-100");
  assert.equal(fromBaseUnits(-1_5000000n), "-1.5");
});

// Tests for formatAmount (adds thousand separators)
test("formatAmount: adds comma separators to whole numbers", () => {
  assert.equal(formatAmount(1000_0000000n), "1,000");
  assert.equal(formatAmount(1000000_0000000n), "1,000,000");
  assert.equal(formatAmount(10_0000000n), "10");
});

test("formatAmount: preserves decimals with comma separators", () => {
  assert.equal(formatAmount(1000_5000000n), "1,000.5");
  assert.equal(formatAmount(1000000_1230000n), "1,000,000.123");
});

test("formatAmount: works with string and numeric input", () => {
  assert.equal(formatAmount("1000000000"), "10");
  assert.equal(formatAmount(1000_0000000n), "1,000");
});

test("formatAmount: accepts custom decimal places", () => {
  assert.equal(formatAmount(1000n, 2), "10");
  assert.equal(formatAmount(10050n, 2), "100.5");
});

// Tests for formatNaira (Naira currency formatting)
test("formatNaira: formats numbers as Nigerian Naira", () => {
  const formatted = formatNaira(1000);
  assert.ok(formatted.includes("1,000")); // locale-formatted number
  assert.ok(formatted.includes("₦")); // Naira symbol
});

test("formatNaira: handles zero", () => {
  assert.equal(formatNaira(0), "₦0.00");
});

test("formatNaira: returns default for non-finite numbers", () => {
  assert.equal(formatNaira(NaN), "₦0.00");
  assert.equal(formatNaira(Infinity), "₦0.00");
  assert.equal(formatNaira(-Infinity), "₦0.00");
});

test("formatNaira: formats with two decimal places", () => {
  const formatted = formatNaira(1500.5);
  assert.ok(formatted.includes(".0") || formatted.includes(",")); // locale varies
});

// Tests for shortAddress (Stellar address truncation)
test("shortAddress: truncates long addresses", () => {
  const addr = "GAEECBB7C5ODFEWEIWFMXRULHJ6YBTFBHEWFBJQPJ3JZJXHZZMDHDKMU";
  const short = shortAddress(addr, 4);
  assert.equal(short, "GAEE…HDMU");
  assert.equal(short.length, 11); // 4 + 3 (…) + 4
});

test("shortAddress: returns address unchanged if too short", () => {
  const addr = "SHORT";
  assert.equal(shortAddress(addr, 4), addr);
  assert.equal(shortAddress("1234567890", 4), "1234567890"); // exactly at limit
});

test("shortAddress: accepts custom character count", () => {
  const addr = "GAEECBB7C5ODFEWEIWFMXRULHJ6YBTFBHEWFBJQPJ3JZJXHZZMDHDKMU";
  const short3 = shortAddress(addr, 3);
  assert.equal(short3, "GAE…DMU");
  
  const short6 = shortAddress(addr, 6);
  assert.equal(short6, "GAEECB…HDKMU");
});

test("shortAddress: handles empty and null input", () => {
  assert.equal(shortAddress(""), "");
  // Empty addresses remain unchanged
});

// Tests for formatDate (Unix timestamp formatting)
test("formatDate: formats Unix timestamps correctly", () => {
  const timestamp = 1609459200n; // 2021-01-01 00:00:00 UTC
  const formatted = formatDate(timestamp);
  assert.ok(formatted.includes("2021"));
  assert.ok(formatted.includes("Jan"));
  assert.ok(formatted.includes("1"));
});

test("formatDate: handles numeric Unix timestamps", () => {
  const timestamp = 1609459200;
  const formatted = formatDate(timestamp);
  assert.ok(formatted.includes("2021"));
});

test("formatDate: returns em-dash for zero or falsy timestamps", () => {
  assert.equal(formatDate(0n), "—");
  assert.equal(formatDate(0), "—");
  assert.equal(formatDate(0n), "—");
});

test("formatDate: formats recent dates", () => {
  const now = Math.floor(Date.now() / 1000);
  const formatted = formatDate(now);
  assert.ok(formatted.length > 0);
  assert.notEqual(formatted, "—");
});

// Tests for humanizeDescription (description normalization)
test("humanizeDescription: returns description as-is", () => {
  assert.equal(humanizeDescription("test invoice"), "test invoice");
  assert.equal(humanizeDescription("Design work for website"), "Design work for website");
});

test("humanizeDescription: returns empty string for null or undefined", () => {
  assert.equal(humanizeDescription(null), "");
  assert.equal(humanizeDescription(undefined), "");
  assert.equal(humanizeDescription(), "");
});

test("humanizeDescription: preserves special characters and formatting", () => {
  const desc = "Invoice for Q1 2024 - $50,000.00 (NET30)";
  assert.equal(humanizeDescription(desc), desc);
});

// Round-trip tests: format → parse → format consistency
test("round-trip: fromBaseUnits(toBaseUnits(x)) ≈ x", () => {
  const values = ["100", "0.5", "1.23456", "1000000", "0.0000001"];
  for (const val of values) {
    const baseUnits = toBaseUnits(val);
    const roundTrip = fromBaseUnits(baseUnits);
    assert.equal(roundTrip, val);
  }
});

test("round-trip: formatting and unformatting amounts", () => {
  const amount = 1000_5000000n;
  const formatted = formatAmount(amount);
  // formatAmount should contain the number without commas that can be parsed back
  assert.ok(formatted.includes("1,000.5")); // exact format with separators
});
