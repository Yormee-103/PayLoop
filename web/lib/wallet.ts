// Wallet facade used by the app. Only this module imports concrete adapters,
// so contract.ts and the UI never import a wallet SDK directly.

import {
  isConnected,
  isAllowed,
  setAllowed,
  getAddress,
  getNetwork,
  signTransaction,
  WatchWalletChanges,
} from "@stellar/freighter-api";
import { config } from "./config";
import type { WalletChange } from "./wallet-state";

export type WalletState = {
  installed: boolean;
  address: string | null;
  network: string | null;
  networkPassphrase: string | null;
};

export async function detectWallet(): Promise<WalletState> {
  const empty: WalletState = {
    installed: false,
    address: null,
    network: null,
    networkPassphrase: null,
  };
  if (typeof window === "undefined") return empty;
  try {
    const connected = await isConnected();
    if (!connected.isConnected) return empty;
    const allowed = await isAllowed();
    if (!allowed.isAllowed) {
      return { ...empty, installed: true };
    }
    const [addr, net] = await Promise.all([getAddress(), getNetwork()]);
    return {
      installed: true,
      address: addr.address || null,
      network: net.network || null,
      networkPassphrase: net.networkPassphrase || null,
    };
  } catch {
    return empty;
  }
}

// Freighter's WatchWalletChanges polls the extension and reports account and
// network switches. Return a stop function so the provider can clean up.
export function watchWallet(onChange: (change: WalletChange) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const watcher = new WatchWalletChanges(3000);
  watcher.watch(onChange);
  return () => watcher.stop();
}

export async function connectWallet(): Promise<string> {
  if (typeof window === "undefined") throw new Error("No window");
  const connected = await isConnected();
  if (!connected.isConnected) {
    throw new Error(
      "Freighter wallet not found. Install it from freighter.app to continue."
    );
  }
  const res = await setAllowed();
  if (!res.isAllowed) {
    throw new Error("Wallet connection was declined.");
  }
}

export async function subscribeWalletChanges(
  id: WalletId,
  listener: (change: WalletChange) => void
): Promise<Unsubscribe> {
  const adapter = getWalletAdapter(id);
  if (!adapter.subscribe) return () => {};
  try {
    return await adapter.subscribe(listener);
  } catch {
    return () => {};
  }
}

// contract.ts calls this unchanged. Guard against a wallet that reports a
// different network before asking for a signature, so users get one clear,
// wallet-agnostic message instead of a failed transaction.
export async function signXdr(xdr: string): Promise<string> {
  const adapter = getWalletAdapter(getActiveWalletId());
  const network = await adapter.getNetwork().catch(() => null);
  if (
    network &&
    !isExpectedNetwork(network.networkPassphrase, config.networkPassphrase)
  ) {
    throw new Error(WRONG_NETWORK_MESSAGE);
  }
  return adapter.signXdr(xdr);
}
