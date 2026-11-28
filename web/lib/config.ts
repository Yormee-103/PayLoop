import { StrKey } from "@stellar/stellar-sdk";

// Central place for all network + contract configuration, sourced from env.
// Everything here is public (NEXT_PUBLIC_*) and safe to ship to the browser.
//
// The defaults below are the live PayLoop testnet deployment, so a fresh clone
// (or a Vercel deploy without env overrides) runs against the real contract out
// of the box. Set NEXT_PUBLIC_* to point at a different deployment.

const DEFAULT_CONTRACT_ID =
  "CAQVSBNVL7OI66IDTYCR7XL4VJKMSOYGBW5D6SWLTWTINTCQO2OGCSXS";
const DEFAULT_TOKEN_ID =
  "CA3DMMHKAEV555MKWZB5AFXWB6LVZRETYNUO5ZCFGSENQOC7A2FL5HNU";
// The USDC SAC wraps this classic asset. The issuer is needed to build the
// changeTrust op that lets a wallet hold/send USDC (Freighter's asset UI is
// unreliable across versions, so we establish the trustline in-app).
const DEFAULT_TOKEN_ISSUER =
  "GDYPHJ7H2DO6OUWD5ZJRLFT57QNUZYOWBBYEHEQBAGJDFBAAFJWMXSNU";
// Legacy default for the account used as the simulation source on read calls.
// It never signs anything, so deployments can point at any funded account.
export const DEFAULT_READ_SOURCE =
  "GBTDIHYJA4OPTDBDRKH5A5PHBSH7QVAEY46V27DCB24SXNRXIQNHSNUM";

export function resolveReadSource(value?: string): string {
  return value?.trim() || DEFAULT_READ_SOURCE;
}

export type TokenConfig = {
  id: string;
  issuer: string;
  symbol: string;
  decimals: number;
};

export type ConfigEnv = {
  NEXT_PUBLIC_CONTRACT_ID?: string;
  NEXT_PUBLIC_TOKEN_ID?: string;
  NEXT_PUBLIC_TOKEN_DECIMALS?: string;
  NEXT_PUBLIC_TOKENS?: string;
  NEXT_PUBLIC_RPC_URL?: string;
  NEXT_PUBLIC_HORIZON_URL?: string;
  NEXT_PUBLIC_READ_SOURCE?: string;
};

const DEFAULT_RPC_URL = "https://soroban-testnet.stellar.org";
const DEFAULT_HORIZON_URL = "https://horizon-testnet.stellar.org";

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidDecimals(value: unknown): boolean {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0 && value <= 18;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return false;
    const n = Number(trimmed);
    return Number.isInteger(n) && n >= 0 && n <= 18;
  }
  return false;
}

export function validateConfig(env: ConfigEnv): string[] {
  const errors: string[] = [];

  const contractId = env.NEXT_PUBLIC_CONTRACT_ID ?? DEFAULT_CONTRACT_ID;
  if (!StrKey.isValidContract(contractId)) {
    errors.push(
      `NEXT_PUBLIC_CONTRACT_ID must be a valid Stellar contract ID (C... StrKey), got "${contractId}".`,
    );
  }

  const tokenId = env.NEXT_PUBLIC_TOKEN_ID ?? DEFAULT_TOKEN_ID;
  if (!StrKey.isValidContract(tokenId)) {
    errors.push(
      `NEXT_PUBLIC_TOKEN_ID must be a valid Stellar contract ID (C... StrKey), got "${tokenId}".`,
    );
  }

  const rawDecimals = env.NEXT_PUBLIC_TOKEN_DECIMALS ?? "7";
  if (!isValidDecimals(rawDecimals)) {
    errors.push(
      `NEXT_PUBLIC_TOKEN_DECIMALS must be an integer between 0 and 18, got "${rawDecimals}".`,
    );
  }

  const rpcUrl = env.NEXT_PUBLIC_RPC_URL ?? DEFAULT_RPC_URL;
  if (!isValidHttpUrl(rpcUrl)) {
    errors.push(
      `NEXT_PUBLIC_RPC_URL must be a valid http(s) URL, got "${rpcUrl}".`,
    );
  }

  const horizonUrl = env.NEXT_PUBLIC_HORIZON_URL ?? DEFAULT_HORIZON_URL;
  if (!isValidHttpUrl(horizonUrl)) {
    errors.push(
      `NEXT_PUBLIC_HORIZON_URL must be a valid http(s) URL, got "${horizonUrl}".`,
    );
  }

  const readSource = resolveReadSource(env.NEXT_PUBLIC_READ_SOURCE);
  if (!StrKey.isValidEd25519PublicKey(readSource)) {
    errors.push(
      `NEXT_PUBLIC_READ_SOURCE must be a valid Stellar account public key (G... StrKey), got "${readSource}".`,
    );
  }

  if (env.NEXT_PUBLIC_TOKENS) {
    try {
      const parsed: unknown = JSON.parse(env.NEXT_PUBLIC_TOKENS);
      if (!Array.isArray(parsed)) {
        errors.push(
          "NEXT_PUBLIC_TOKENS must be a JSON array of token objects.",
        );
      } else {
        parsed.forEach((entry, index) => {
          if (!entry || typeof entry !== "object") {
            errors.push(`NEXT_PUBLIC_TOKENS[${index}] must be an object.`);
            return;
          }
          const t = entry as Record<string, unknown>;
          const id = typeof t.id === "string" ? t.id : "";
          if (!StrKey.isValidContract(id)) {
            errors.push(
              `NEXT_PUBLIC_TOKENS[${index}].id must be a valid Stellar contract ID (C... StrKey), got "${String(t.id ?? "")}".`,
            );
          }
          const issuer = typeof t.issuer === "string" ? t.issuer : "";
          if (!StrKey.isValidEd25519PublicKey(issuer)) {
            errors.push(
              `NEXT_PUBLIC_TOKENS[${index}].issuer must be a valid Stellar account public key (G... StrKey), got "${String(t.issuer ?? "")}".`,
            );
          }
          if (t.decimals !== undefined && !isValidDecimals(t.decimals)) {
            errors.push(
              `NEXT_PUBLIC_TOKENS[${index}].decimals must be an integer between 0 and 18, got "${String(t.decimals)}".`,
            );
          }
        });
      }
    } catch {
      errors.push("NEXT_PUBLIC_TOKENS must be valid JSON.");
    }
  }

  return errors;
}

const DEFAULT_TOKEN: TokenConfig = {
  id: process.env.NEXT_PUBLIC_TOKEN_ID ?? DEFAULT_TOKEN_ID,
  issuer: DEFAULT_TOKEN_ISSUER,
  symbol: process.env.NEXT_PUBLIC_TOKEN_SYMBOL ?? "USDC",
  decimals: Number(process.env.NEXT_PUBLIC_TOKEN_DECIMALS ?? "7"),
};

// Additional invoice tokens are configured as JSON so no code change is needed
// when the contract allowlist grows. Symbol/decimals are only fallbacks: the
// app reads the authoritative values from each token contract at runtime.
function parseTokens(): TokenConfig[] {
  const raw = process.env.NEXT_PUBLIC_TOKENS;
  if (!raw) return [DEFAULT_TOKEN];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [DEFAULT_TOKEN];
    const extra = parsed
      .filter((t): t is Record<string, unknown> =>
        Boolean(t && typeof t === "object" && t.id && t.issuer),
      )
      .map((t) => ({
        id: String(t.id),
        issuer: String(t.issuer),
        symbol: String(t.symbol ?? "TOKEN"),
        decimals: Number(t.decimals ?? 7),
      }))
      .filter((t) => t.id !== DEFAULT_TOKEN.id);
    return [DEFAULT_TOKEN, ...extra];
  } catch {
    return [DEFAULT_TOKEN];
  }
}

export const tokens: TokenConfig[] = parseTokens();

export function getTokenConfig(id?: string): TokenConfig {
  return tokens.find((t) => t.id === id) ?? DEFAULT_TOKEN;
}

export const config = {
  network: process.env.NEXT_PUBLIC_NETWORK ?? "TESTNET",
  networkPassphrase:
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ??
    "Test SDF Network ; September 2015",
  rpcUrl:
    process.env.NEXT_PUBLIC_RPC_URL ?? "https://soroban-testnet.stellar.org",
  horizonUrl:
    process.env.NEXT_PUBLIC_HORIZON_URL ??
    "https://horizon-testnet.stellar.org",
  contractId: process.env.NEXT_PUBLIC_CONTRACT_ID ?? DEFAULT_CONTRACT_ID,
  readSource: resolveReadSource(process.env.NEXT_PUBLIC_READ_SOURCE),
  tokenId: DEFAULT_TOKEN.id,
  tokenIssuer: DEFAULT_TOKEN.issuer,
  tokenDecimals: DEFAULT_TOKEN.decimals,
  tokenSymbol: DEFAULT_TOKEN.symbol,
  tokens,
} as const;

export const configErrors: readonly string[] = validateConfig({
  NEXT_PUBLIC_CONTRACT_ID: process.env.NEXT_PUBLIC_CONTRACT_ID,
  NEXT_PUBLIC_TOKEN_ID: process.env.NEXT_PUBLIC_TOKEN_ID,
  NEXT_PUBLIC_TOKEN_DECIMALS: process.env.NEXT_PUBLIC_TOKEN_DECIMALS,
  NEXT_PUBLIC_TOKENS: process.env.NEXT_PUBLIC_TOKENS,
  NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL,
  NEXT_PUBLIC_HORIZON_URL: process.env.NEXT_PUBLIC_HORIZON_URL,
  NEXT_PUBLIC_READ_SOURCE: process.env.NEXT_PUBLIC_READ_SOURCE,
});

export function isConfigured(): boolean {
  return (
    configErrors.length === 0 && Boolean(config.contractId && config.tokenId)
  );
}

// Mock exchange rate used for demonstration off-ramp conversions
export const NGN_PER_USDC = 1560;

// Supported UI locales. English is the source of truth; other locales fall back
// to English for any missing message key. See the contributor guide for adding one.
export const SUPPORTED_LOCALES = ["en", "fr"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

// Cookie used to persist the user's chosen locale across visits.
export const LOCALE_COOKIE = "payloop_locale";

// Human-readable names for the language switcher, keyed by locale code.
export const localeLabels: Record<Locale, string> = {
  en: "English",
  fr: "Français",
};

export function isSupportedLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

// Normalise an arbitrary value (e.g. a cookie or query param) to a supported locale.
export function resolveLocale(value: unknown): Locale {
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}

// Missing keys in a non-default locale fall back to English. English is the
// only fallback target, so every locale resolves its fallback to DEFAULT_LOCALE.
export function getMessageFallbackLocale(_locale: Locale): Locale {
  return DEFAULT_LOCALE;
}

// stellar.expert explorer helpers for building clickable proof links.
const explorerBase =
  config.network === "PUBLIC"
    ? "https://stellar.expert/explorer/public"
    : "https://stellar.expert/explorer/testnet";

export const explorer = {
  tx: (hash: string) => `${explorerBase}/tx/${hash}`,
  account: (addr: string) => `${explorerBase}/account/${addr}`,
  contract: (id: string) => `${explorerBase}/contract/${id}`,
};
