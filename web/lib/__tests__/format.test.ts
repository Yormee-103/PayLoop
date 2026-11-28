import { describe, expect, it } from "vitest";
import {
  formatAmount,
  formatDate,
  formatNaira,
  fromBaseUnits,
  humanizeDescription,
  shortAddress,
  toBaseUnits,
} from "../format";

describe("toBaseUnits", () => {
  it("converts whole numbers and decimals to stroops", () => {
    expect(toBaseUnits("100")).toBe(100_0000000n);
    expect(toBaseUnits("100.5")).toBe(100_5000000n);
    expect(toBaseUnits("0.0000001")).toBe(1n);
    expect(toBaseUnits("0")).toBe(0n);
  });

  it("truncates excess decimal places", () => {
    expect(toBaseUnits("1.12345678")).toBe(1_1234567n);
  });

  it("handles numeric, negative, whitespace, empty, and custom decimals", () => {
    expect(toBaseUnits(100)).toBe(100_0000000n);
    expect(toBaseUnits("-1.5")).toBe(-1_5000000n);
    expect(toBaseUnits("  100  ")).toBe(100_0000000n);
    expect(toBaseUnits("")).toBe(0n);
    expect(toBaseUnits("   ")).toBe(0n);
    expect(toBaseUnits("100.5", 2)).toBe(10050n);
  });
});

describe("fromBaseUnits", () => {
  it("converts base units to trimmed human-readable strings", () => {
    expect(fromBaseUnits(100_0000000n)).toBe("100");
    expect(fromBaseUnits(100_5000000n)).toBe("100.5");
    expect(fromBaseUnits(0n)).toBe("0");
    expect(fromBaseUnits("10050", 2)).toBe("100.5");
  });
});

describe("formatAmount", () => {
  it("adds thousands separators and preserves fractional digits", () => {
    expect(formatAmount(1234567_5000000n)).toBe("1,234,567.5");
    expect(formatAmount(1000_0000000n)).toBe("1,000");
    expect(formatAmount(0n)).toBe("0");
  });
});

describe("formatNaira", () => {
  it("formats finite numbers as NGN and falls back for non-finite values", () => {
    expect(formatNaira(NaN)).toBe("₦0.00");
    expect(formatNaira(Infinity)).toBe("₦0.00");
    expect(formatNaira(1500)).toContain("1,500");
  });
});

describe("shortAddress", () => {
  it("truncates long addresses and preserves short or empty strings", () => {
    const addr = `G${"A".repeat(55)}`;
    expect(shortAddress(addr)).toBe("GAAA…AAAA");
    expect(shortAddress(addr, 6)).toBe("GAAAAA…AAAAAA");
    expect(shortAddress("GSHORT")).toBe("GSHORT");
    expect(shortAddress("")).toBe("");
  });
});

describe("formatDate", () => {
  it("returns an em dash for zero and formats unix seconds", () => {
    expect(formatDate(0)).toBe("—");
    expect(formatDate(0n)).toBe("—");
    const formatted = formatDate(1700000000);
    expect(formatted).toContain("2023");
  });
});

describe("humanizeDescription", () => {
  it("returns the description or empty string for nullish values", () => {
    expect(humanizeDescription("Design work")).toBe("Design work");
    expect(humanizeDescription(null)).toBe("");
    expect(humanizeDescription(undefined)).toBe("");
  });
});
