import test from "node:test";
import assert from "node:assert/strict";
import { escapeCsvCell, toCsv } from "../csv.ts";

test("toCsv prepends UTF-8 BOM and quotes every field", () => {
  const csv = toCsv([
    ["id", "description", "amount"],
    ["1", "Logo design", "350"],
  ]);

  assert.equal(csv.startsWith("\uFEFF"), true);
  assert.equal(
    csv,
    '\uFEFF"id","description","amount"\n"1","Logo design","350"',
  );
});

test("toCsv preserves Naira and other Unicode characters", () => {
  const csv = toCsv([["currency", "note"], ["₦", "PayLoop — résumé"]]);
  assert.equal(csv, '\uFEFF"currency","note"\n"₦","PayLoop — résumé"');
});

test("toCsv doubles internal quotes and handles commas and newlines", () => {
  const csv = toCsv([
    ["description"],
    ['Design "v2", phase 1\nwith notes'],
  ]);
  assert.equal(
    csv,
    '\uFEFF"description"\n"Design ""v2"", phase 1\nwith notes"',
  );
});

test("toCsv neutralizes formula-injection prefixes", () => {
  const payloads = [
    '=HYPERLINK("https://evil.test","Click")',
    "+1+1",
    "-1+1",
    "@SUM(1,2)",
    "\tcmd",
    "\rcmd",
  ];

  for (const payload of payloads) {
    const cell = escapeCsvCell(payload);
    assert.equal(cell.startsWith('"\''), true, `expected prefix for ${payload}`);
  }

  const csv = toCsv([
    ["description"],
    ['=HYPERLINK("https://evil.test","Click")'],
  ]);
  assert.equal(
    csv,
    '\uFEFF"description"\n"\'=HYPERLINK(""https://evil.test"",""Click"")"',
  );
});

test("toCsv handles nullish, numeric, bigint, and boolean values", () => {
  const csv = toCsv([[1, 2n, true, null, undefined]]);
  assert.equal(csv, '\uFEFF"1","2","true","",""');
});

test("toCsv handles empty rows array", () => {
  assert.equal(toCsv([]), "\uFEFF");
});
