import { config } from "./config.ts";

export type WalletSnapshot = {
  address: string | null;
  network: string | null;
  networkPassphrase: string | null;
  installed: boolean;
};

export type WalletChange = {
  address: string;
  network: string;
  networkPassphrase: string;
  error?: unknown;
};

export type WalletUpdateResult = {
  next: WalletSnapshot;
  connected: boolean;
  changed: boolean;
};

// Freighter reports its passphrase, which is the reliable way to detect a
// wrong-network switch. An unknown passphrase is not treated as wrong, so a
// wallet that does not expose it still gets the existing behaviour.
export function isWrongNetwork(networkPassphrase: string | null): boolean {
  return Boolean(
    networkPassphrase && networkPassphrase !== config.networkPassphrase
  );
}

// Applies a Freighter watch event without wiping state on a transient RPC
// error. An empty address means the account was disconnected or revoked.
export function applyWalletChange(
  current: WalletSnapshot,
  change: WalletChange
): WalletUpdateResult {
  if (change.error) {
    return { next: current, connected: Boolean(current.address), changed: false };
  }

  if (!change.address) {
    return {
      next: { ...current, address: null, network: null, networkPassphrase: null },
      connected: false,
      changed: Boolean(current.address || current.network || current.networkPassphrase),
    };
  }

  const changed =
    current.address !== change.address ||
    current.network !== change.network ||
    current.networkPassphrase !== change.networkPassphrase;

  return {
    next: {
      ...current,
      address: change.address,
      network: change.network,
      networkPassphrase: change.networkPassphrase,
      installed: true,
    },
    connected: true,
    changed,
  };
}
