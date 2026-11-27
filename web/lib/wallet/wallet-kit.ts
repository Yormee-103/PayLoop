// Adapters for xBull, Albedo, Lobstr and Hana. Stellar Wallets Kit keeps the
// per-wallet connection details behind one API; PayLoop still owns the picker
// and the wording shown to users.

import { config } from "../config";
import { walletErrorMessage } from "./errors";
import { networkName } from "./networks";
import type { WalletAdapter, WalletChange, WalletNetwork, WalletState } from "./types";
import type { Networks } from "@creit.tech/stellar-wallets-kit/types";

type KitWalletId = Exclude<WalletAdapter["id"], "freighter">;

type KitModule = {
  StellarWalletsKit: typeof import("@creit.tech/stellar-wallets-kit/sdk").StellarWalletsKit;
  KitEventType: typeof import("@creit.tech/stellar-wallets-kit/types").KitEventType;
  ids: Record<KitWalletId, string>;
};

let kitPromise: Promise<KitModule> | null = null;

function loadKit(): Promise<KitModule> {
  if (!kitPromise) {
    kitPromise = (async () => {
      const [
        sdk,
        types,
        xbull,
        albedo,
        lobstr,
        hana,
      ] = await Promise.all([
        import("@creit.tech/stellar-wallets-kit/sdk"),
        import("@creit.tech/stellar-wallets-kit/types"),
        import("@creit.tech/stellar-wallets-kit/modules/xbull"),
        import("@creit.tech/stellar-wallets-kit/modules/albedo"),
        import("@creit.tech/stellar-wallets-kit/modules/lobstr"),
        import("@creit.tech/stellar-wallets-kit/modules/hana"),
      ]);

      sdk.StellarWalletsKit.init({
        modules: [
          new xbull.xBullModule(),
          new albedo.AlbedoModule(),
          new lobstr.LobstrModule(),
          new hana.HanaModule(),
        ],
        // Kit's enum values are Stellar network passphrases, so the configured
        // passphrase can be passed through even for custom networks.
        network: config.networkPassphrase as unknown as Networks,
      });

      return {
        StellarWalletsKit: sdk.StellarWalletsKit,
        KitEventType: types.KitEventType,
        ids: {
          xbull: xbull.XBULL_ID,
          albedo: albedo.ALBEDO_ID,
          lobstr: lobstr.LOBSTR_ID,
          hana: hana.HANA_ID,
        },
      };
    })().catch((cause) => {
      kitPromise = null;
      throw cause;
    });
  }
  return kitPromise;
}

function emptyState(): WalletState {
  return { installed: false, address: null, network: null, networkPassphrase: null };
}

const KIT_WALLET_NAMES: Record<KitWalletId, string> = {
  xbull: "xBull",
  albedo: "Albedo",
  lobstr: "Lobstr",
  hana: "Hana",
};

export function createWalletKitAdapter(id: KitWalletId): WalletAdapter {
  const name = KIT_WALLET_NAMES[id];

  return {
    id,
    name,

    async detect(): Promise<WalletState> {
      if (typeof window === "undefined") return emptyState();
      try {
        const { StellarWalletsKit, ids } = await loadKit();
        StellarWalletsKit.setWallet(ids[id]);
        StellarWalletsKit.setNetwork(config.networkPassphrase as unknown as Networks);
        const { address } = await StellarWalletsKit.getAddress();
        return {
          // Web wallets such as Albedo are reachable without an extension;
          // availability is only decided when the user actually connects.
          installed: true,
          address: address || null,
          network: config.network,
          networkPassphrase: config.networkPassphrase,
        };
      } catch {
        return emptyState();
      }
    },

    async connect(): Promise<string> {
      if (typeof window === "undefined") {
        throw new Error(walletErrorMessage("No window", "connect"));
      }
      try {
        const { StellarWalletsKit, ids } = await loadKit();
        StellarWalletsKit.setWallet(ids[id]);
        StellarWalletsKit.setNetwork(config.networkPassphrase as unknown as Networks);
        const { address } = await StellarWalletsKit.fetchAddress();
        if (!address) throw new Error("No address returned");
        return address;
      } catch (cause) {
        throw new Error(walletErrorMessage(cause, "connect"));
      }
    },

    async signXdr(xdr: string): Promise<string> {
      try {
        const { StellarWalletsKit } = await loadKit();
        const result = await StellarWalletsKit.signTransaction(xdr, {
          networkPassphrase: config.networkPassphrase,
        });
        if (!result.signedTxXdr) throw new Error("No signature returned");
        return result.signedTxXdr;
      } catch (cause) {
        throw new Error(walletErrorMessage(cause, "sign"));
      }
    },

    async getNetwork(): Promise<WalletNetwork> {
      // None of xBull, Albedo, Lobstr or Hana can report their active network
      // through SEP-43. Kit is configured with PayLoop's passphrase and every
      // signing request passes it explicitly, so that is the effective network.
      return {
        network: config.network,
        networkPassphrase: config.networkPassphrase,
      };
    },

    async disconnect(): Promise<void> {
      try {
        const { StellarWalletsKit } = await loadKit();
        await StellarWalletsKit.disconnect();
      } catch (cause) {
        throw new Error(walletErrorMessage(cause, "disconnect"));
      }
    },

    async subscribe(listener: (change: WalletChange) => void) {
      if (typeof window === "undefined") return () => {};
      const { StellarWalletsKit, KitEventType, ids } = await loadKit();
      StellarWalletsKit.setWallet(ids[id]);

      let active = true;
      const offState = StellarWalletsKit.on(
        KitEventType.STATE_UPDATED,
        (event) => {
          if (!active) return;
          const passphrase =
            event.payload.networkPassphrase || config.networkPassphrase;
          const change: WalletChange = {
            network: networkName(passphrase, config.network),
            networkPassphrase: passphrase,
          };
          // Kit emits an initial state event with no address. That is not a
          // disconnect, so leave `address` out and let the provider ignore it.
          if (event.payload.address !== undefined) {
            change.address = event.payload.address || null;
          }
          listener(change);
        }
      );
      const offDisconnect = StellarWalletsKit.on(
        KitEventType.DISCONNECT,
        () => {
          if (active) listener({ address: null, disconnected: true });
        }
      );

      // Some wallets do not emit state changes. Re-read Kit's cached state when
      // the user returns to the tab so a switch made in the wallet is picked up.
      const onFocus = () => {
        void StellarWalletsKit.getAddress()
          .then(({ address }) => {
            if (active) listener({ address: address || null });
          })
          .catch(() => {});
      };
      window.addEventListener("focus", onFocus);

      return () => {
        active = false;
        offState();
        offDisconnect();
        window.removeEventListener("focus", onFocus);
      };
    },
  };
}
