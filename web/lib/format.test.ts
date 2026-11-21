import { describe, expect, it } from "vitest";
import { parseAmount, toBaseUnits, fromBaseUnits, formatAmount } from "./format";

describe("Amount Parsing and Validation (Issue #6)", () => {
  describe("parseAmount - valid inputs", () => {
    it("parses valid positive integer amounts", () => {
      const res = parseAmount("1500");
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value).toBe(15000000000n);
        expect(res.human).toBe("1500");
      }
    });

    it("parses valid decimal amounts up to 7 decimal places", () => {
      const res = parseAmount("1500.50");
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value).toBe(15005000000n);
      }

      const resSmall = parseAmount("0.1234567");
      expect(resSmall.ok).toBe(true);
      if (resSmall.ok) {
        expect(resSmall.value).toBe(1234567n);
      }
    });

    it("accepts the minimum unit (1 stroop = 0.0000001)", () => {
      const res = parseAmount("0.0000001");
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value).toBe(1n);
      }
    });

    it("accepts number values as input", () => {
      const res = parseAmount(100);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value).toBe(1000000000n);
      }
    });
  });

  describe("parseAmount - rejected non-standard inputs (prevents render crash)", () => {
    it("rejects scientific notation with a friendly error", () => {
      const res = parseAmount("1e3");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain("Scientific notation is not supported");
      }

      const resCap = parseAmount("1E5");
      expect(resCap.ok).toBe(false);
      if (!resCap.ok) {
        expect(resCap.error).toContain("Scientific notation is not supported");
      }
    });

    it("rejects underscores in numeric strings", () => {
      const res = parseAmount("1_000");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain("Underscores are not supported");
      }
    });

    it("rejects hexadecimal strings", () => {
      const res = parseAmount("0x10");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain("Hexadecimal numbers are not supported");
      }
    });

    it("rejects Infinity and NaN", () => {
      expect(parseAmount("Infinity").ok).toBe(false);
      expect(parseAmount("-Infinity").ok).toBe(false);
      expect(parseAmount("NaN").ok).toBe(false);
      expect(parseAmount(Infinity).ok).toBe(false);
      expect(parseAmount(NaN).ok).toBe(false);
    });

    it("rejects numbers exceeding 7 decimals without silently truncating", () => {
      const res = parseAmount("1.123456789");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain("Maximum 7 decimal places allowed");
      }
    });

    it("rejects sub-stroop amounts (more than 7 decimals)", () => {
      const res = parseAmount("0.00000001");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain("Maximum 7 decimal places allowed");
      }
    });

    it("rejects zero and all-zero fractional amounts", () => {
      const resZero = parseAmount("0");
      expect(resZero.ok).toBe(false);
      if (!resZero.ok) {
        expect(resZero.error).toContain("Minimum amount is 0.0000001");
      }

      const resZeroDec = parseAmount("0.0000000");
      expect(resZeroDec.ok).toBe(false);
      if (!resZeroDec.ok) {
        expect(resZeroDec.error).toContain("Minimum amount is 0.0000001");
      }
    });

    it("rejects negative amounts", () => {
      const resNeg = parseAmount("-10");
      expect(resNeg.ok).toBe(false);
      if (!resNeg.ok) {
        expect(resNeg.error).toContain("Enter an amount greater than zero");
      }
    });

    it("rejects empty or whitespace inputs", () => {
      expect(parseAmount("").ok).toBe(false);
      expect(parseAmount("   ").ok).toBe(false);
      expect(parseAmount(null).ok).toBe(false);
      expect(parseAmount(undefined).ok).toBe(false);
    });
  });

  describe("toBaseUnits - safe throwing behavior", () => {
    it("converts valid strings to bigint base units", () => {
      expect(toBaseUnits("1500")).toBe(15000000000n);
      expect(toBaseUnits("0.5")).toBe(5000000n);
      expect(toBaseUnits("0.0000001")).toBe(1n);
    });

    it("throws a clear descriptive Error instead of a raw SyntaxError on invalid inputs", () => {
      expect(() => toBaseUnits("1e3")).toThrowError(
        /Invalid amount "1e3": Scientific notation is not supported/
      );
      expect(() => toBaseUnits("1_000")).toThrowError(
        /Invalid amount "1_000": Underscores are not supported/
      );
      expect(() => toBaseUnits("0x10")).toThrowError(
        /Invalid amount "0x10": Hexadecimal numbers are not supported/
      );
      expect(() => toBaseUnits("1.123456789")).toThrowError(
        /Maximum 7 decimal places allowed/
      );
    });
  });
});
