"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { connectWallet, detectWallet, watchWallet } from "@/lib/wallet";
import { errorMessage } from "@/lib/async-resource";
import {
  applyWalletChange,
  isWrongNetwork,
  type WalletChange,
  type WalletSnapshot,
} from "@/lib/wallet-state";

type WalletContextValue = WalletSnapshot & {
  connecting: boolean;
  pickerOpen: boolean;
  wrongNetwork: boolean;
  error: string | null;
  clearError: () => void;
  wrongNetwork: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

const STORAGE_KEY = "payloop.wallet.connected";

const INITIAL: WalletSnapshot = {
  address: null,
  network: null,
  networkPassphrase: null,
  installed: true,
};

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<WalletSnapshot>(INITIAL);
  const [connecting, setConnecting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRemembered = useCallback(() => {
    try {
      return Boolean(localStorage.getItem(STORAGE_KEY));
    } catch {
      return false;
    }
  }, []);

  const markConnected = useCallback((connected: boolean) => {
    try {
      if (connected) localStorage.setItem(STORAGE_KEY, "1");
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage can be blocked; in-memory wallet state still works.
    }
  }, []);

  // On mount, re-hydrate if the user previously connected, then keep watching
  // Freighter for account, network and disconnect changes.
  useEffect(() => {
    let active = true;
    let stopWatching: (() => void) | null = null;

    const refresh = () => {
      if (!active) return;
      void detectWallet().then((state) => {
        if (!active) return;
        setWallet((current) => {
          const result = applyWalletChange(current, {
            address: isRemembered() ? state.address ?? "" : "",
            network: state.network ?? "",
            networkPassphrase: state.networkPassphrase ?? "",
          });
          if (result.changed) markConnected(result.connected);
          return result.next;
        });
      });
    };

    (async () => {
      const state = await detectWallet();
      if (!active) return;
      const remembered = isRemembered();
      setWallet((current) => ({
        ...current,
        installed: state.installed,
        address: remembered ? state.address : null,
        network: remembered ? state.network : null,
        networkPassphrase: remembered ? state.networkPassphrase : null,
      }));

      const onChange = (change: WalletChange) => {
        if (!active) return;
        setWallet((current) => {
          const result = applyWalletChange(current, {
            ...change,
            address: isRemembered() ? change.address : "",
          });
          if (result.changed || result.next.address !== current.address) {
            markConnected(result.connected);
          }
          return result.next;
        });
      };

      stopWatching = watchWallet(onChange);
      window.addEventListener("focus", refresh);
    })();

    return () => {
      active = false;
      stopWatching?.();
      window.removeEventListener("focus", refresh);
    };
  }, [isRemembered, markConnected]);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const addr = await connectWallet();
      const state = await detectWallet();
      setWallet({
        installed: true,
        address: addr,
        network: state.network,
        networkPassphrase: state.networkPassphrase,
      });
      markConnected(true);
    } catch (e) {
      const message = errorMessage(e, "Failed to connect wallet.");
      setError(message);
      if (message.toLowerCase().includes("not found")) {
        setWallet((current) => ({ ...current, installed: false }));
      }
    } finally {
      setConnecting(false);
    }
  }, [markConnected]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const disconnect = useCallback(() => {
    setWallet((current) => ({
      ...current,
      address: null,
      network: null,
      networkPassphrase: null,
    }));
    setError(null);
    markConnected(false);
  }, [markConnected]);

  const closeWalletPicker = useCallback(() => {
    setPickerOpen(false);
  }, []);

  const wrongNetwork = Boolean(
    address && networkPassphrase && networkPassphrase !== config.networkPassphrase
  );

  const value = useMemo(
    () => ({
      ...wallet,
      connecting,
      pickerOpen,
      wrongNetwork,
      error,
      clearError,
      wrongNetwork:
        isWrongNetwork(wallet.networkPassphrase) && Boolean(wallet.address),
      connect,
      disconnect,
      openWalletPicker,
      closeWalletPicker,
    }),
    [wallet, connecting, error, clearError, connect, disconnect],
  );

  return (
    <WalletContext.Provider value={value}>
      {children}
      <WalletPicker />
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
