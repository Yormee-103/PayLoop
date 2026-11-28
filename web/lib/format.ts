import { config } from "./config.ts";

// Token amounts are integers in "stroops" of the token (7 decimals for USDC).
// The UI works in human units; convert at the boundary.

export function toBaseUnits(
  human: string | number,
  decimals: number = config.tokenDecimals
): bigint {
  const s = typeof human === "number" ? human.toString() : human.trim();
  if (!s) return 0n;
  const [whole, frac = ""] = s.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const sign = whole.startsWith("-") ? -1n : 1n;
  const wholeAbs = whole.replace("-", "") || "0";
  return sign * (BigInt(wholeAbs) * 10n ** BigInt(decimals) + BigInt(fracPadded || "0"));
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

// Locale-aware grouping: "en" uses commas, "fr" uses narrow no-break spaces.
export function formatAmount(
  base: bigint | string | number,
  decimals: number = config.tokenDecimals,
  locale: string | undefined = undefined
): string {
  const human = fromBaseUnits(base, decimals);
  const [whole, frac] = human.split(".");
  const grouped = new Intl.NumberFormat(locale, { useGrouping: true })
    .format(BigInt(whole));
  return frac ? `${grouped}${decimalSeparator(locale)}${frac}` : grouped;
}

function decimalSeparator(locale: string | undefined): string {
  const parts = new Intl.NumberFormat(locale).formatToParts(1.1);
  return parts.find((p) => p.type === "decimal")?.value ?? ".";
}

export function formatNaira(amount: number, locale: string = "en-NG"): string {
  if (!Number.isFinite(amount)) return "₦0.00";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "NGN",
  }).format(amount);
}

export function shortAddress(addr: string, chars = 4): string {
  if (!addr || addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`;
}

export function formatDate(unixSeconds: bigint | number, locale?: string): string {
  const n = typeof unixSeconds === "bigint" ? Number(unixSeconds) : unixSeconds;
  if (!n) return "—";
  return new Date(n * 1000).toLocaleDateString(locale, {
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
