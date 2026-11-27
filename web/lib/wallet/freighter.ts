// Freighter does not need Stellar Wallets Kit; it stays on the official API so
// the existing desktop flow keeps its current permission behaviour.

import { config } from "../config";
import {
  WALLET_DECLINED_MESSAGE,
  walletErrorMessage,
} from "./errors";
import { networkName } from "./networks";
import type {
  Unsubscribe,
  WalletAdapter,
  WalletChange,
  WalletNetwork,
  WalletState,
} from "./types";

type FreighterApi = typeof import("@stellar/freighter-api");

let apiPromise: Promise<FreighterApi> | null = null;

function freighterApi(): Promise<FreighterApi> {
  if (!apiPromise) apiPromise = import("@stellar/freighter-api");
  return apiPromise;
}

function emptyState(): WalletState {
  return { installed: false, address: null, network: null, networkPassphrase: null };
}

async function currentState(): Promise<WalletState> {
  if (typeof window === "undefined") return emptyState();
  try {
    const api = await freighterApi();
    const connected = await api.isConnected();
    if (!connected.isConnected) return emptyState();
    const allowed = await api.isAllowed();
    if (!allowed.isAllowed || allowed.error) {
      return { ...emptyState(), installed: true };
    }
    const [address, network] = await Promise.all([
      api.getAddress(),
      api.getNetwork(),
    ]);
    return {
      installed: true,
      address: address.address || null,
      network: network.network || networkName(network.networkPassphrase),
      networkPassphrase: network.networkPassphrase || null,
    };
  } catch {
    return emptyState();
  }
}

export function createFreighterAdapter(): WalletAdapter {
  return {
    id: "freighter",
    name: "Freighter",

    detect: currentState,

    async connect(): Promise<string> {
      if (typeof window === "undefined") {
        throw new Error(walletErrorMessage("No window", "connect"));
      }
      try {
        const api = await freighterApi();
        const connected = await api.isConnected();
        if (!connected.isConnected) {
          throw new Error(walletErrorMessage("Wallet not found", "connect"));
        }
        const allowed = await api.setAllowed();
        if (!allowed.isAllowed || allowed.error) {
          throw new Error(WALLET_DECLINED_MESSAGE);
        }
        const address = await api.getAddress();
        if (address.error || !address.address) {
          throw new Error(walletErrorMessage(address.error ?? "No address", "connect"));
        }
        return address.address;
      } catch (cause) {
        throw new Error(walletErrorMessage(cause, "connect"));
      }
    },

    async signXdr(xdr: string): Promise<string> {
      try {
        const api = await freighterApi();
        const result = await api.signTransaction(xdr, {
          networkPassphrase: config.networkPassphrase,
        });
        if (result.error || !result.signedTxXdr) {
          throw new Error(walletErrorMessage(result.error ?? "No signature", "sign"));
        }
        return result.signedTxXdr;
      } catch (cause) {
        throw new Error(walletErrorMessage(cause, "sign"));
      }
    },

    async getNetwork(): Promise<WalletNetwork> {
      try {
        const api = await freighterApi();
        const result = await api.getNetwork();
        if (result.error) throw new Error(result.error.message ?? "Network error");
        return {
          network: result.network || networkName(result.networkPassphrase),
          networkPassphrase: result.networkPassphrase || config.networkPassphrase,
        };
      } catch (cause) {
        throw new Error(walletErrorMessage(cause, "network"));
      }
    },

    async subscribe(listener: (change: WalletChange) => void): Promise<Unsubscribe> {
      if (typeof window === "undefined") return () => {};
      try {
        const api = await freighterApi();
        const watcher = new api.WatchWalletChanges();
        watcher.watch((params) => {
          // An empty address means "not allowed yet", not a real disconnect.
          if (!params.address) return;
          listener({
            address: params.address,
            network: params.network || networkName(params.networkPassphrase),
            networkPassphrase: params.networkPassphrase || null,
          });
        });
        return () => watcher.stop();
      } catch {
        return () => {};
      }
    },
  };
}
