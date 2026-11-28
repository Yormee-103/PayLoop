export type CsvCell = string | number | bigint | boolean | null | undefined;

const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;
const UTF8_BOM = "\uFEFF";

/**
 * Escapes a single CSV cell:
 * - Converts nullish values to empty string
 * - Prefixes `'` to cells starting with `=`, `+`, `-`, `@`, `\t`, or `\r` to
 *   prevent spreadsheet formula injection
 * - Doubles internal double quotes and wraps the cell in double quotes
 */
export function escapeCsvCell(value: CsvCell): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const safe = FORMULA_PREFIX_RE.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

/**
 * Serializes a 2D array of cells to a UTF-8 BOM-prefixed CSV string.
 * The BOM ensures Excel renders Naira (₦) and other Unicode text correctly.
 */
export function toCsv(rows: ReadonlyArray<ReadonlyArray<CsvCell>>): string {
  const body = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  return `${UTF8_BOM}${body}`;
}
