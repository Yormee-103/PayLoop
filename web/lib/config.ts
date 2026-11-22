// Central place for all network + contract configuration, sourced from env.
// Everything here is public (NEXT_PUBLIC_*) and safe to ship to the browser.
//
// The defaults below are the live PayLoop testnet deployment, so a fresh clone
// (or a Vercel deploy without env overrides) runs against the real contract out
// of the box. Set NEXT_PUBLIC_* to point at a different deployment.

import { StrKey } from "@stellar/stellar-sdk";

const DEFAULT_CONTRACT_ID =
  "CAQVSBNVL7OI66IDTYCR7XL4VJKMSOYGBW5D6SWLTWTINTCQO2OGCSXS";
const DEFAULT_TOKEN_ID =
  "CA3DMMHKAEV555MKWZB5AFXWB6LVZRETYNUO5ZCFGSENQOC7A2FL5HNU";
// The USDC SAC wraps this classic asset. The issuer is needed to build the
// changeTrust op that lets a wallet hold/send USDC (Freighter's asset UI is
// unreliable across versions, so we establish the trustline in-app).
const DEFAULT_TOKEN_ISSUER =
  "GDYPHJ7H2DO6OUWD5ZJRLFT57QNUZYOWBBYEHEQBAGJDFBAAFJWMXSNU";

function parseDecimals(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return 7;
  return Number(raw);
}

export interface ConfigValidationError {
  field: string;
  value: unknown;
  message: string;
}

export type AppConfig = {
  network: string;
  networkPassphrase: string;
  rpcUrl: string;
  horizonUrl: string;
  contractId: string;
  tokenId: string;
  tokenIssuer: string;
  tokenDecimals: number;
  tokenSymbol: string;
};

export const config: AppConfig = {
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
  tokenId: process.env.NEXT_PUBLIC_TOKEN_ID ?? DEFAULT_TOKEN_ID,
  tokenIssuer: process.env.NEXT_PUBLIC_TOKEN_ISSUER ?? DEFAULT_TOKEN_ISSUER,
  tokenDecimals: parseDecimals(process.env.NEXT_PUBLIC_TOKEN_DECIMALS),
  tokenSymbol: process.env.NEXT_PUBLIC_TOKEN_SYMBOL ?? "USDC",
};

export function validateConfig(cfg: AppConfig = config): ConfigValidationError[] {
  const errors: ConfigValidationError[] = [];

  // 1. Contract ID validation (StrKey Contract C...)
  if (!cfg.contractId || typeof cfg.contractId !== "string" || cfg.contractId.trim() === "") {
    errors.push({
      field: "NEXT_PUBLIC_CONTRACT_ID",
      value: cfg.contractId,
      message: "Contract ID is required. Must be a 56-character Soroban contract address starting with 'C'.",
    });
  } else if (!StrKey.isValidContract(cfg.contractId)) {
    errors.push({
      field: "NEXT_PUBLIC_CONTRACT_ID",
      value: cfg.contractId,
      message: "Invalid contract address. Must be a valid 56-character StrKey contract identifier starting with 'C'.",
    });
  }

  // 2. Token Contract ID validation (StrKey Contract C...)
  if (!cfg.tokenId || typeof cfg.tokenId !== "string" || cfg.tokenId.trim() === "") {
    errors.push({
      field: "NEXT_PUBLIC_TOKEN_ID",
      value: cfg.tokenId,
      message: "Token ID is required. Must be a 56-character Soroban token contract address starting with 'C'.",
    });
  } else if (!StrKey.isValidContract(cfg.tokenId)) {
    errors.push({
      field: "NEXT_PUBLIC_TOKEN_ID",
      value: cfg.tokenId,
      message: "Invalid token contract address. Must be a valid 56-character StrKey contract identifier starting with 'C'.",
    });
  }

  // 3. Token Issuer validation (Optional or StrKey Public Key G...)
  if (cfg.tokenIssuer && !StrKey.isValidEd25519PublicKey(cfg.tokenIssuer)) {
    errors.push({
      field: "NEXT_PUBLIC_TOKEN_ISSUER",
      value: cfg.tokenIssuer,
      message: "Invalid token issuer address. Must be a valid 56-character Stellar account public key starting with 'G'.",
    });
  }

  // 4. Token Decimals validation (Integer between 0 and 18)
  if (
    typeof cfg.tokenDecimals !== "number" ||
    Number.isNaN(cfg.tokenDecimals) ||
    !Number.isInteger(cfg.tokenDecimals) ||
    cfg.tokenDecimals < 0 ||
    cfg.tokenDecimals > 18
  ) {
    errors.push({
      field: "NEXT_PUBLIC_TOKEN_DECIMALS",
      value: cfg.tokenDecimals,
      message: "Token decimals must be an integer between 0 and 18 (received invalid or NaN value).",
    });
  }

  // 5. RPC URL validation (valid http/https URL)
  if (!cfg.rpcUrl || typeof cfg.rpcUrl !== "string" || cfg.rpcUrl.trim() === "") {
    errors.push({
      field: "NEXT_PUBLIC_RPC_URL",
      value: cfg.rpcUrl,
      message: "RPC URL is required.",
    });
  } else {
    try {
      const parsed = new URL(cfg.rpcUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        errors.push({
          field: "NEXT_PUBLIC_RPC_URL",
          value: cfg.rpcUrl,
          message: "RPC URL must use the http:// or https:// protocol.",
        });
      }
    } catch {
      errors.push({
        field: "NEXT_PUBLIC_RPC_URL",
        value: cfg.rpcUrl,
        message: "RPC URL must be a valid absolute URL.",
      });
    }
  }

  // 6. Horizon URL validation (valid http/https URL)
  if (!cfg.horizonUrl || typeof cfg.horizonUrl !== "string" || cfg.horizonUrl.trim() === "") {
    errors.push({
      field: "NEXT_PUBLIC_HORIZON_URL",
      value: cfg.horizonUrl,
      message: "Horizon URL is required.",
    });
  } else {
    try {
      const parsed = new URL(cfg.horizonUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        errors.push({
          field: "NEXT_PUBLIC_HORIZON_URL",
          value: cfg.horizonUrl,
          message: "Horizon URL must use the http:// or https:// protocol.",
        });
      }
    } catch {
      errors.push({
        field: "NEXT_PUBLIC_HORIZON_URL",
        value: cfg.horizonUrl,
        message: "Horizon URL must be a valid absolute URL.",
      });
    }
  }

  // 7. Network validation
  if (!cfg.network || typeof cfg.network !== "string" || cfg.network.trim() === "") {
    errors.push({
      field: "NEXT_PUBLIC_NETWORK",
      value: cfg.network,
      message: "Network identifier is required (e.g., 'TESTNET' or 'PUBLIC').",
    });
  }

  return errors;
}

export function getConfigErrors(cfg: AppConfig = config): string[] {
  return validateConfig(cfg).map(
    (e) => `${e.field}: ${e.message} (received: ${JSON.stringify(e.value)})`
  );
}

export function isConfigured(cfg: AppConfig = config): boolean {
  return validateConfig(cfg).length === 0;
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
