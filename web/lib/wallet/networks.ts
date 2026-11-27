// Network helpers live in a pure module so they can be tested with node:test
// without importing any wallet SDK.

export const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
export const PUBLIC_PASSPHRASE = "Public Global Stellar Network ; September 2015";

export function networkName(
  passphrase?: string | null,
  fallback = "CUSTOM"
): string {
  if (passphrase === TESTNET_PASSPHRASE) return "TESTNET";
  if (passphrase === PUBLIC_PASSPHRASE) return "PUBLIC";
  if (passphrase) return fallback;
  return fallback;
}

export function isExpectedNetwork(
  actual: string | null | undefined,
  expected: string
): boolean {
  // A wallet that cannot report its network (several Kit wallets can't) is
  // allowed through; the network passphrase is supplied at signing time.
  return !actual || actual === expected;
}
