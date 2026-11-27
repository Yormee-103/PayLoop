import { config } from "./config.ts";

// Token amounts are integers in "stroops" of the token (7 decimals for USDC).
// The UI works in human units; convert at the boundary.

const AMOUNT_RE = /^\d+(\.\d{1,7})?$/;

export type ParseAmountResult =
  | { ok: true; value: bigint }
  | { ok: false; error: string };

/**
 * Strictly parses a user-entered human amount into base units.
 * Accepts only plain decimal numbers with up to `decimals` fractional digits.
 * Rejects exponent notation, hex, separators, signs, and extra precision.
 * The result must be at least one base unit.
 */
export function parseAmount(
  input: string,
  decimals: number = config.tokenDecimals
): ParseAmountResult {
  const s = (input ?? "").trim();
  if (!s) return { ok: false, error: "Enter an amount." };
  const re = new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`);
  if (!re.test(s)) {
    return {
      ok: false,
      error: `Use digits only, with at most ${decimals} decimal places (e.g. 12.5).`,
    };
  }
  const value = toBaseUnitsUnchecked(s, decimals);
  if (value <= 0n) {
    return {
      ok: false,
      error: `Amount must be at least ${fromBaseUnits(1n, decimals)}.`,
    };
  }
  return { ok: true, value };
}

function toBaseUnitsUnchecked(s: string, decimals: number): bigint {
  const [whole, frac = ""] = s.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
}

export function toBaseUnits(
  human: string | number,
  decimals: number = config.tokenDecimals
): bigint {
  const s = typeof human === "number" ? human.toString() : human.trim();
  if (!s) return 0n;
  if (!/^-?\d+(\.\d+)?$/.test(s)) {
    throw new Error(`Invalid amount: "${s}"`);
  }
  const negative = s.startsWith("-");
  const magnitude = toBaseUnitsUnchecked(negative ? s.slice(1) : s, decimals);
  return negative ? -magnitude : magnitude;
}

export function fromBaseUnits(
  base: bigint | string | number,
  decimals: number = config.tokenDecimals
): string {
  const b = typeof base === "bigint" ? base : BigInt(base);
  const divisor = 10n ** BigInt(decimals);
  const whole = b / divisor;
  const frac = (b % divisor).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

export function formatAmount(
  base: bigint | string | number,
  decimals: number = config.tokenDecimals
): string {
  const human = fromBaseUnits(base, decimals);
  const [whole, frac] = human.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac ? `${withCommas}.${frac}` : withCommas;
}

export function formatNaira(amount: number): string {
  if (!Number.isFinite(amount)) return "₦0.00";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
  }).format(amount);
}

export function shortAddress(addr: string, chars = 4): string {
  if (!addr || addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`;
}

export function formatDate(unixSeconds: bigint | number): string {
  const n = typeof unixSeconds === "bigint" ? Number(unixSeconds) : unixSeconds;
  if (!n) return "—";
  return new Date(n * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Descriptions are displayed exactly as recorded on-chain. A few early demo
// invoices carry placeholder text (e.g. "test invoice from bot") in the
// immutable contract; we deliberately do NOT reword them into nicer copy in
// the UI — what the contract recorded is what users see.
export function humanizeDescription(desc?: string | null): string {
  return desc ?? "";
}
