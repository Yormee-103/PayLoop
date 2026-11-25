export type FaucetSuccessResponse = {
  ok: true;
  hash: string;
  mintedAmount?: string | number | bigint;
  mintedAmountHuman?: string | number;
  assetSymbol?: string;
};

export type FaucetErrorResponse = {
  ok?: false;
  error: string;
};

export type FaucetResponse = FaucetSuccessResponse | FaucetErrorResponse;

export type FaucetConfirmationOptions = {
  stroopsPerUnit?: bigint;
  decimals?: number;
  fallbackAmount?: string | number;
  symbol?: string;
};

export function isFaucetSuccess(response: FaucetResponse): response is FaucetSuccessResponse {
  return response.ok === true && typeof response.hash === "string";
}

export function normalizeFaucetAmount(
  response: FaucetSuccessResponse,
  options: FaucetConfirmationOptions = {},
): string {
  const decimals = options.decimals ?? 7;
  const stroopsPerUnit = options.stroopsPerUnit ?? 10n ** BigInt(decimals);

  if (typeof response.mintedAmountHuman === "string" || typeof response.mintedAmountHuman === "number") {
    return formatDecimalAmount(response.mintedAmountHuman, decimals);
  }

  if (typeof response.mintedAmount === "bigint") {
    return stroopsToDecimal(response.mintedAmount, decimals, stroopsPerUnit);
  }

  if (typeof response.mintedAmount === "number" || typeof response.mintedAmount === "string") {
    return formatDecimalAmount(response.mintedAmount, decimals);
  }

  return formatDecimalAmount(options.fallbackAmount ?? 500, decimals);
}

export function formatFaucetConfirmationMessage(
  response: FaucetResponse,
  options: FaucetConfirmationOptions = {},
): string {
  if (!isFaucetSuccess(response)) {
    return response.error || "Faucet failed.";
  }
  const symbol = response.assetSymbol ?? options.symbol ?? "test USDC";
  return `Sent ${normalizeFaucetAmount(response, options)} ${symbol}`;
}

function stroopsToDecimal(value: bigint, decimals: number, stroopsPerUnit: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / stroopsPerUnit;
  const fraction = absolute % stroopsPerUnit;
  if (fraction === 0n) return `${negative ? "-" : ""}${whole}`;
  const padded = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}.${padded}`;
}

function formatDecimalAmount(value: string | number, decimals: number): string {
  const text = String(value);
  if (!/^\d+(\.\d+)?$/.test(text)) return text;
  const [whole, fraction = ""] = text.split(".");
  if (!fraction) return whole;
  const trimmed = fraction.slice(0, decimals).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}
