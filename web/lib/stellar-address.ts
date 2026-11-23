import { StrKey } from "@stellar/stellar-sdk";

/** Return a user-facing validation error for a client account address. */
export function clientAddressError(address: string): string | null {
  const value = address.trim();
  if (value.startsWith("M")) {
    return "Muxed addresses (M…) are not supported for invoice clients. Enter a G… account address.";
  }
  if (value.startsWith("C")) {
    return "Contract addresses (C…) cannot receive client invoices. Enter a G… account address.";
  }
  if (!StrKey.isValidEd25519PublicKey(value)) {
    return "Enter a valid Stellar account address. Check the characters and checksum.";
  }
  return null;
}
