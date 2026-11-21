import { StrKey } from "@stellar/stellar-sdk";

export type AddressValidationResult =
  | { valid: true; address: string }
  | {
      valid: false;
      error: string;
      kind: "empty" | "contract" | "muxed" | "invalid_checksum" | "malformed" | "self";
    };

/**
 * Validates a client Stellar public address with checksum verification.
 * Distinguishes between contract addresses, muxed addresses, malformed inputs,
 * and checksum typos to prevent creating immutable on-chain invoices with invalid recipients.
 */
export function validateClientAddress(
  rawInput: string | undefined | null,
  ownAddress?: string | null
): AddressValidationResult {
  const input = rawInput?.trim();
  if (!input) {
    return {
      valid: false,
      error: "Enter a valid client Stellar address.",
      kind: "empty",
    };
  }

  // Reject contract addresses (C...)
  if (input.startsWith("C") || StrKey.isValidContract(input)) {
    return {
      valid: false,
      error: "Contract addresses (starting with C) cannot be used as client addresses. Enter a standard Stellar account (G...).",
      kind: "contract",
    };
  }

  // Reject muxed accounts (M...)
  if (input.startsWith("M") || StrKey.isValidMed25519PublicKey(input)) {
    return {
      valid: false,
      error: "Muxed addresses (starting with M) are not supported for invoices. Enter a standard Stellar account (G...).",
      kind: "muxed",
    };
  }

  // Must start with G and be exactly 56 characters
  if (!input.startsWith("G") || input.length !== 56) {
    return {
      valid: false,
      error: "Stellar account public keys must start with 'G' and be 56 characters long.",
      kind: "malformed",
    };
  }

  // Validate CRC16 checksum using StrKey ed25519 public key decoder
  if (!StrKey.isValidEd25519PublicKey(input)) {
    return {
      valid: false,
      error: "Invalid Stellar address checksum. Please check for mistyped characters.",
      kind: "invalid_checksum",
    };
  }

  // Disallow invoicing self
  if (ownAddress && input === ownAddress) {
    return {
      valid: false,
      error: "The client can't be your own address.",
      kind: "self",
    };
  }

  return {
    valid: true,
    address: input,
  };
}
