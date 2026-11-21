import { describe, expect, it } from "vitest";
import { escapeCell, FORMULA_PREFIXES, toCsv, UTF8_BOM } from "../csv";

describe("CSV Utility (lib/csv.ts)", () => {
  describe("escapeCell", () => {
    it("neutralizes formula injection with '=' prefix (e.g. HYPERLINK)", () => {
      const malicious = '=HYPERLINK("https://attacker.example.com", "Malicious")';
      const escaped = escapeCell(malicious);
      expect(escaped).toBe(
        `"'=HYPERLINK(""https://attacker.example.com"", ""Malicious"")"`
      );
    });

    it("neutralizes other formula prefixes (+, -, @, \\t, \\r)", () => {
      expect(escapeCell("+12345")).toBe(`"'+12345"`);
      expect(escapeCell("-99.50")).toBe(`"'-99.50"`);
      expect(escapeCell("@SUM(A1:A10)")).toBe(`"'@SUM(A1:A10)"`);
      expect(escapeCell("\tcmd|' /C calc'!A0")).toBe(`"'\tcmd|' /C calc'!A0"`);
      expect(escapeCell("\rdata")).toBe(`"'\rdata"`);
    });

    it("escapes internal double quotes by doubling them per RFC 4180", () => {
      expect(escapeCell('Web "Design" Services')).toBe(
        `"Web ""Design"" Services"`
      );
      expect(escapeCell('"""')).toBe(`""""""""`);
    });

    it("quotes standard benign values without formula prefixes", () => {
      expect(escapeCell("PayLoop Invoice 42")).toBe(`"PayLoop Invoice 42"`);
      expect(escapeCell("GD5J...4XZA")).toBe(`"GD5J...4XZA"`);
      expect(escapeCell(100)).toBe(`"100"`);
      expect(escapeCell(0)).toBe(`"0"`);
      expect(escapeCell(BigInt("10000000"))).toBe(`"10000000"`);
      expect(escapeCell(true)).toBe(`"true"`);
      expect(escapeCell(false)).toBe(`"false"`);
    });

    it("handles null and undefined gracefully as empty quoted cells", () => {
      expect(escapeCell(null)).toBe('""');
      expect(escapeCell(undefined)).toBe('""');
      expect(escapeCell("")).toBe('""');
    });

    it("preserves currency symbols like Naira (₦) and Unicode text", () => {
      expect(escapeCell("₦1,500,000.00")).toBe(`"₦1,500,000.00"`);
      expect(escapeCell("Consultation 💼 - Lagos & Abuja")).toBe(
        `"Consultation 💼 - Lagos & Abuja"`
      );
    });
  });

  describe("toCsv", () => {
    it("prepends the UTF-8 Byte Order Mark (BOM) to the output", () => {
      const csv = toCsv([["header1", "header2"]]);
      expect(csv.startsWith(UTF8_BOM)).toBe(true);
      expect(csv.charCodeAt(0)).toBe(0xfeff);
    });

    it("quotes every field and joins columns with commas", () => {
      const rows = [
        ["id", "amount", "status"],
        ["1", "50.00", "Paid"],
      ];
      const csv = toCsv(rows);
      expect(csv).toBe(
        `${UTF8_BOM}"id","amount","status"\r\n"1","50.00","Paid"`
      );
    });

    it("properly isolates formula-injected descriptions in real invoice datasets", () => {
      const dataset = [
        ["invoice_id", "description", "status"],
        ["1", "=1+1", "Pending"],
        ["2", "Clean invoice", "Paid"],
        ["3", "@evil_calc", "Disputed"],
      ];
      const csv = toCsv(dataset);

      // Verify the formula cells are safely single-quoted
      expect(csv).toContain(`"1","'=1+1","Pending"`);
      expect(csv).toContain(`"2","Clean invoice","Paid"`);
      expect(csv).toContain(`"3","'@evil_calc","Disputed"`);
    });

    it("handles empty input table", () => {
      expect(toCsv([])).toBe(UTF8_BOM);
    });

    it("ensures all formula prefixes are listed in FORMULA_PREFIXES constant", () => {
      expect(FORMULA_PREFIXES).toEqual(["=", "+", "-", "@", "\t", "\r"]);
    });
  });
});
