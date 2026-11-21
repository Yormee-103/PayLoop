import { config } from "./config";

// Token amounts are integers in "stroops" of the token (7 decimals for USDC).
// The UI works in human units; convert at the boundary.

export type ParseAmountResult =
  | { ok: true; value: bigint; human: string }
  | { ok: false; error: string };

/**
 * Validates and parses a human-readable token amount into its base integer units.
 * Rejects scientific notation ("1e3"), hex ("0x10"), underscores ("1_000"),
 * non-finite strings ("Infinity"), negative values, extra decimals (> tokenDecimals),
 * and amounts less than one base unit (0.0000001).
 */
export function parseAmount(
  input: string | number | undefined | null
): ParseAmountResult {
  if (input === undefined || input === null) {
    return { ok: false, error: "Enter an amount greater than zero." };
  }
  const s = typeof input === "number" ? input.toString() : input.trim();
  if (!s) {
    return { ok: false, error: "Enter an amount greater than zero." };
  }

  // Friendly errors for common non-standard inputs
  if (/e/i.test(s)) {
    return {
      ok: false,
      error: "Scientific notation is not supported. Enter a standard decimal amount.",
    };
  }
  if (s.startsWith("0x") || s.startsWith("0X")) {
    return {
      ok: false,
      error: "Hexadecimal numbers are not supported. Enter a standard decimal amount.",
    };
  }
  if (s.includes("_")) {
    return {
      ok: false,
      error: "Underscores are not supported in amounts. Enter digits only.",
    };
  }
  if (s === "Infinity" || s === "-Infinity" || s === "NaN") {
    return { ok: false, error: "Enter a valid finite amount." };
  }

  const decimals = config.tokenDecimals;
  // Strict regex: positive integer or decimal with up to `decimals` decimal places
  const regex = new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`);
  if (!regex.test(s)) {
    if (s.startsWith("-")) {
      return { ok: false, error: "Enter an amount greater than zero." };
    }
    const parts = s.split(".");
    if (parts.length > 2) {
      return { ok: false, error: "Enter a valid amount with only one decimal point." };
    }
    if (parts[1] && parts[1].length > decimals) {
      return {
        ok: false,
        error: `Maximum ${decimals} decimal places allowed.`,
      };
    }
    return { ok: false, error: "Enter a valid amount (e.g. 1500.00)." };
  }

  const [whole, frac = ""] = s.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const baseUnits =
    BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");

  if (baseUnits <= 0n) {
    return { ok: false, error: "Minimum amount is 0.0000001 (1 base unit)." };
  }

  return { ok: true, value: baseUnits, human: s };
}

export function toBaseUnits(human: string | number): bigint {
  const parsed = parseAmount(human);
  if (!parsed.ok) {
    throw new Error(`Invalid amount "${human}": ${parsed.error}`);
  }
  return parsed.value;
}

export function fromBaseUnits(base: bigint | string | number): string {
  const b = typeof base === "bigint" ? base : BigInt(base);
  const decimals = config.tokenDecimals;
  const divisor = 10n ** BigInt(decimals);
  const whole = b / divisor;
  const frac = (b % divisor).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

export function formatAmount(base: bigint | string | number): string {
  const human = fromBaseUnits(base);
  const [whole, frac] = human.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac ? `${withCommas}.${frac}` : withCommas;
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
