import { describe, it, expect } from "vitest";
import {
  config,
  validateConfig,
  getConfigErrors,
  isConfigured,
  type AppConfig,
} from "./config";

describe("Configuration Validation (config.ts)", () => {
  it("validates the default configuration successfully with 0 errors", () => {
    const errors = validateConfig(config);
    expect(errors).toEqual([]);
    expect(isConfigured(config)).toBe(true);
    expect(getConfigErrors(config)).toEqual([]);
  });

  describe("Contract ID and Token ID validation", () => {
    it("flags missing or empty contractId", () => {
      const cfg: AppConfig = { ...config, contractId: "" };
      const errors = validateConfig(cfg);
      expect(errors.some((e) => e.field === "NEXT_PUBLIC_CONTRACT_ID")).toBe(true);
      expect(isConfigured(cfg)).toBe(false);
    });

    it("flags invalid StrKey contractId (wrong prefix or invalid checksum)", () => {
      const cfg: AppConfig = {
        ...config,
        contractId: "GDYPHJ7H2DO6OUWD5ZJRLFT57QNUZYOWBBYEHEQBAGJDFBAAFJWMXSNU", // G-address instead of C-contract
      };
      const errors = validateConfig(cfg);
      const contractError = errors.find((e) => e.field === "NEXT_PUBLIC_CONTRACT_ID");
      expect(contractError).toBeDefined();
      expect(contractError?.message).toContain("starting with 'C'");
    });

    it("flags invalid StrKey tokenId", () => {
      const cfg: AppConfig = {
        ...config,
        tokenId: "INVALID_TOKEN_CONTRACT_IDENTIFIER",
      };
      const errors = validateConfig(cfg);
      expect(errors.some((e) => e.field === "NEXT_PUBLIC_TOKEN_ID")).toBe(true);
    });
  });

  describe("Token Issuer validation", () => {
    it("accepts a valid G-account public key for tokenIssuer", () => {
      const cfg: AppConfig = {
        ...config,
        tokenIssuer: "GDYPHJ7H2DO6OUWD5ZJRLFT57QNUZYOWBBYEHEQBAGJDFBAAFJWMXSNU",
      };
      const errors = validateConfig(cfg);
      expect(errors.some((e) => e.field === "NEXT_PUBLIC_TOKEN_ISSUER")).toBe(false);
    });

    it("flags invalid StrKey tokenIssuer", () => {
      const cfg: AppConfig = {
        ...config,
        tokenIssuer: "CAQVSBNVL7OI66IDTYCR7XL4VJKMSOYGBW5D6SWLTWTINTCQO2OGCSXS", // C-contract instead of G-key
      };
      const errors = validateConfig(cfg);
      expect(errors.some((e) => e.field === "NEXT_PUBLIC_TOKEN_ISSUER")).toBe(true);
    });
  });

  describe("Token Decimals validation", () => {
    it("flags NaN tokenDecimals", () => {
      const cfg: AppConfig = { ...config, tokenDecimals: Number("not_a_number") };
      const errors = validateConfig(cfg);
      const decError = errors.find((e) => e.field === "NEXT_PUBLIC_TOKEN_DECIMALS");
      expect(decError).toBeDefined();
      expect(decError?.message).toContain("integer between 0 and 18");
    });

    it("flags negative tokenDecimals", () => {
      const cfg: AppConfig = { ...config, tokenDecimals: -1 };
      const errors = validateConfig(cfg);
      expect(errors.some((e) => e.field === "NEXT_PUBLIC_TOKEN_DECIMALS")).toBe(true);
    });

    it("flags fractional / float tokenDecimals", () => {
      const cfg: AppConfig = { ...config, tokenDecimals: 7.5 };
      const errors = validateConfig(cfg);
      expect(errors.some((e) => e.field === "NEXT_PUBLIC_TOKEN_DECIMALS")).toBe(true);
    });

    it("flags tokenDecimals greater than 18", () => {
      const cfg: AppConfig = { ...config, tokenDecimals: 19 };
      const errors = validateConfig(cfg);
      expect(errors.some((e) => e.field === "NEXT_PUBLIC_TOKEN_DECIMALS")).toBe(true);
    });

    it("accepts valid boundary decimals (0 and 18)", () => {
      expect(validateConfig({ ...config, tokenDecimals: 0 })).toEqual([]);
      expect(validateConfig({ ...config, tokenDecimals: 18 })).toEqual([]);
    });
  });

  describe("RPC URL and Horizon URL validation", () => {
    it("flags malformed or non-URL rpcUrl", () => {
      const cfg: AppConfig = { ...config, rpcUrl: "not-a-valid-url" };
      const errors = validateConfig(cfg);
      expect(errors.some((e) => e.field === "NEXT_PUBLIC_RPC_URL")).toBe(true);
    });

    it("flags non-http/https protocol in rpcUrl (e.g. ftp://)", () => {
      const cfg: AppConfig = { ...config, rpcUrl: "ftp://soroban.example.com" };
      const errors = validateConfig(cfg);
      const rpcError = errors.find((e) => e.field === "NEXT_PUBLIC_RPC_URL");
      expect(rpcError?.message).toContain("http:// or https://");
    });

    it("flags malformed horizonUrl", () => {
      const cfg: AppConfig = { ...config, horizonUrl: "ht!tp://bad-url" };
      const errors = validateConfig(cfg);
      expect(errors.some((e) => e.field === "NEXT_PUBLIC_HORIZON_URL")).toBe(true);
    });
  });

  describe("Network identifier validation", () => {
    it("flags empty or whitespace network", () => {
      const cfg: AppConfig = { ...config, network: "   " };
      const errors = validateConfig(cfg);
      expect(errors.some((e) => e.field === "NEXT_PUBLIC_NETWORK")).toBe(true);
    });
  });

  describe("getConfigErrors helper", () => {
    it("returns formatted error descriptions when configuration is invalid", () => {
      const cfg: AppConfig = {
        ...config,
        contractId: "INVALID",
        tokenDecimals: 99,
      };
      const errorStrings = getConfigErrors(cfg);
      expect(errorStrings.length).toBe(2);
      expect(errorStrings[0]).toContain("NEXT_PUBLIC_CONTRACT_ID");
      expect(errorStrings[1]).toContain("NEXT_PUBLIC_TOKEN_DECIMALS");
    });
  });
});
