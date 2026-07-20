import { config } from "./config";

// Token amounts are integers in "stroops" of the token (7 decimals for USDC).
// The UI works in human units; convert at the boundary.

export function toBaseUnits(human: string | number): bigint {
  const s = typeof human === "number" ? human.toString() : human.trim();
  if (!s) return 0n;
  const [whole, frac = ""] = s.split(".");
  const decimals = config.tokenDecimals;
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const sign = whole.startsWith("-") ? -1n : 1n;
  const wholeAbs = whole.replace("-", "") || "0";
  return sign * (BigInt(wholeAbs) * 10n ** BigInt(decimals) + BigInt(fracPadded || "0"));
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
