import type { WalletId, WalletOption } from "./types.ts";

export const DEFAULT_WALLET_ID: WalletId = "freighter";

// Order is the order shown in the wallet picker. Freighter stays first because
// it is the established desktop path; the rest are powered by Stellar Wallets
// Kit.
export const WALLET_OPTIONS: readonly WalletOption[] = [
  {
    id: "freighter",
    name: "Freighter",
    url: "https://www.freighter.app/",
    kind: "browser",
  },
  {
    id: "xbull",
    name: "xBull",
    url: "https://xbull.app/",
    kind: "wallet-kit",
  },
  {
    id: "albedo",
    name: "Albedo",
    url: "https://albedo.link/",
    kind: "wallet-kit",
  },
  {
    id: "lobstr",
    name: "Lobstr",
    url: "https://lobstr.co/",
    kind: "wallet-kit",
  },
  {
    id: "hana",
    name: "Hana",
    url: "https://hanawallet.io/",
    kind: "wallet-kit",
  },
];

export function isWalletId(value: unknown): value is WalletId {
  return (
    typeof value === "string" &&
    WALLET_OPTIONS.some((option) => option.id === value)
  );
}

export function getWalletOption(id: WalletId): WalletOption {
  return WALLET_OPTIONS.find((option) => option.id === id) ?? WALLET_OPTIONS[0];
}
