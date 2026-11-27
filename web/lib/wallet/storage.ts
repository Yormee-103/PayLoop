// localStorage helpers for the chosen wallet. Kept pure (with an injectable
// Storage-like object) so persistence behaviour is unit-testable.

import { DEFAULT_WALLET_ID, WALLET_OPTIONS, isWalletId } from "./registry.ts";
import type { WalletId } from "./types.ts";

export const WALLET_STORAGE_KEY = "payloop.wallet.id";
export const LEGACY_WALLET_STORAGE_KEY = "payloop.wallet.connected";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type StoredWallet = {
  id: WalletId;
  address: string | null;
};

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function walletAddressKey(id: WalletId): string {
  return `payloop.wallet.${id}.address`;
}

export function readStoredWallet(
  store: StorageLike | null = browserStorage()
): StoredWallet | null {
  if (!store) return null;
  try {
    const rawId = store.getItem(WALLET_STORAGE_KEY);
    let id: WalletId | null = isWalletId(rawId) ? rawId : null;

    // Users upgrading from the Freighter-only build keep their connection.
    if (!id && store.getItem(LEGACY_WALLET_STORAGE_KEY) === "1") {
      id = DEFAULT_WALLET_ID;
      store.setItem(WALLET_STORAGE_KEY, id);
      store.removeItem(LEGACY_WALLET_STORAGE_KEY);
    }
    if (!id) return null;

    return { id, address: store.getItem(walletAddressKey(id)) };
  } catch {
    return null;
  }
}

export function storeWallet(
  id: WalletId,
  address?: string | null,
  store: StorageLike | null = browserStorage()
): void {
  if (!store) return;
  try {
    store.setItem(WALLET_STORAGE_KEY, id);
    store.removeItem(LEGACY_WALLET_STORAGE_KEY);
    if (address === undefined) return;
    if (address) store.setItem(walletAddressKey(id), address);
    else store.removeItem(walletAddressKey(id));
  } catch {
    // Private-mode browsers can block storage; the app still works in memory.
  }
}

export function clearStoredWallet(
  store: StorageLike | null = browserStorage()
): void {
  if (!store) return;
  try {
    store.removeItem(WALLET_STORAGE_KEY);
    store.removeItem(LEGACY_WALLET_STORAGE_KEY);
    for (const option of WALLET_OPTIONS) {
      store.removeItem(walletAddressKey(option.id));
    }
  } catch {
    // Ignore blocked storage.
  }
}
