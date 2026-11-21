/**
 * UTF-8 Byte Order Mark (BOM: \uFEFF).
 * Instructs Microsoft Excel, Google Sheets, and spreadsheet readers to interpret
 * the CSV payload using UTF-8 encoding, preventing corruption of international
 * characters such as the Nigerian Naira symbol (₦) or accented text.
 */
export const UTF8_BOM = "\uFEFF";

/**
 * Characters that trigger formula execution in spreadsheet software (Excel, LibreOffice, Sheets).
 * Cells whose text begins with any of these characters are susceptible to CSV / Formula Injection
 * (e.g., executing `=HYPERLINK()`, DDE payloads, or macro formulas).
 */
export const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"] as const;

/**
 * Escapes an individual cell value according to RFC 4180 rules with formula-injection mitigation:
 * 1. Converts input to string (null / undefined become empty string).
 * 2. If the string starts with any formula prefix (=, +, -, @, \t, \r), it is prepended with
 *    a single quote (') to force spreadsheet software to treat the cell as inert text.
 * 3. Double quotes (") inside the cell are escaped by doubling them ("").
 * 4. Every cell is enclosed in double quotes ("...").
 */
export function escapeCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }
  const str = String(value);
  const isFormula = FORMULA_PREFIXES.some((prefix) => str.startsWith(prefix));
  const sanitized = isFormula ? `'${str}` : str;
  return `"${sanitized.replaceAll('"', '""')}"`;
}

/**
 * Converts a 2D matrix of row cells into a standard, formula-safe CSV string.
 *
 * - Sanitizes every cell using formula-injection guards and quote doubling.
 * - Joins cells in each row with commas (,).
 * - Joins rows using standard CRLF (\r\n).
 * - Prepends the UTF-8 BOM so spreadsheet applications render Unicode cleanly.
 */
export function toCsv(rows: unknown[][]): string {
  const content = rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
  return `${UTF8_BOM}${content}`;
}

export const HISTORY_CSV_HEADERS = [
  "invoice_id",
  "my_role",
  "description",
  "amount_usdc",
  "status",
  "counterparty_address",
  "freelancer_address",
  "client_address",
  "created_at_utc",
  "paid_at_utc",
] as const;

export interface HistoryInvoiceItem {
  id: string;
  description: string;
  amount: bigint;
  status: string;
  freelancer: string;
  client: string;
  createdAt: bigint;
  paidAt: bigint;
}

/**
 * Builds a formula-injection-safe CSV string of personal invoice history.
 *
 * @param invoices - List of invoices to export (already filtered by user).
 * @param currentAddress - The connected user's wallet address to derive `my_role` and counterparty.
 * @param humanizeDesc - Function to format raw description string (e.g. humanizeDescription).
 * @param formatAmt - Function to format base units to human-readable string (e.g. formatAmount).
 */
export function buildHistoryCsv(
  invoices: HistoryInvoiceItem[],
  currentAddress: string,
  humanizeDesc: (desc: string) => string = (d) => d,
  formatAmt: (amount: bigint) => string = (a) => (Number(a) / 10_000_000).toFixed(2)
): string {
  const rows = invoices.map((i) => {
    const isFreelancer = i.freelancer.toLowerCase() === currentAddress.toLowerCase();
    const myRole = isFreelancer ? "freelancer" : "client";
    const counterparty = isFreelancer ? i.client : i.freelancer;
    const createdAtUtc =
      i.createdAt > 0n ? new Date(Number(i.createdAt) * 1000).toISOString() : "";
    const paidAtUtc =
      i.paidAt > 0n ? new Date(Number(i.paidAt) * 1000).toISOString() : "";

    return [
      i.id,
      myRole,
      humanizeDesc(i.description),
      formatAmt(i.amount),
      i.status,
      counterparty,
      i.freelancer,
      i.client,
      createdAtUtc,
      paidAtUtc,
    ];
  });

  return toCsv([[...HISTORY_CSV_HEADERS], ...rows]);
}
