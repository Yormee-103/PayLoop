import test from "node:test";
import assert from "node:assert/strict";
import {
  WALLET_OPTIONS,
  getWalletOption,
  isWalletId,
} from "../wallet/registry.ts";
import {
  WALLET_DECLINED_MESSAGE,
  WALLET_NOT_FOUND_MESSAGE,
  WALLET_SIGN_MESSAGE,
  WRONG_NETWORK_MESSAGE,
  walletErrorMessage,
} from "../wallet/errors.ts";
import { isExpectedNetwork, networkName } from "../wallet/networks.ts";
import {
  LEGACY_WALLET_STORAGE_KEY,
  WALLET_STORAGE_KEY,
  clearStoredWallet,
  readStoredWallet,
  storeWallet,
  walletAddressKey,
} from "../wallet/storage.ts";

function fakeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => void values.set(key, String(value)),
    removeItem: (key) => void values.delete(key),
  };
}

test("wallet registry exposes Freighter and all four Kit wallets", () => {
  assert.deepEqual(
    WALLET_OPTIONS.map((option) => option.id),
    ["freighter", "xbull", "albedo", "lobstr", "hana"]
  );
  assert.equal(WALLET_OPTIONS.filter((o) => o.kind === "wallet-kit").length, 4);
  assert.equal(getWalletOption("xbull").name, "xBull");
});

test("isWalletId rejects unknown ids and non-strings", () => {
  assert.equal(isWalletId("freighter"), true);
  assert.equal(isWalletId("phantom"), false);
  assert.equal(isWalletId(null), false);
  assert.equal(isWalletId({ id: "freighter" }), false);
});

test("wallet errors never leak the wallet name", () => {
  const cases = [
    [
      "Freighter wallet not found. Install it from freighter.app.",
      "connect",
      WALLET_NOT_FOUND_MESSAGE,
    ],
    [
      "Lobstr request rejected by user",
      "connect",
      WALLET_DECLINED_MESSAGE,
    ],
    [
      { error: { message: "Albedo says: different network" } },
      "connect",
      WRONG_NETWORK_MESSAGE,
    ],
    ["xBull could not sign", "sign", WALLET_SIGN_MESSAGE],
  ];

  for (const [cause, action, expected] of cases) {
    const message = walletErrorMessage(cause, action);
    assert.equal(message, expected);
    assert.doesNotMatch(message, /freighter|xbull|albedo|lobstr|hana/i);
  }
});

test("network helpers label known passphrases and allow unknown ones", () => {
  assert.equal(
    networkName("Test SDF Network ; September 2015"),
    "TESTNET"
  );
  assert.equal(
    networkName("Public Global Stellar Network ; September 2015"),
    "PUBLIC"
  );
  assert.equal(networkName("Custom Chain", "DEV"), "DEV");
  assert.equal(
    isExpectedNetwork("Test SDF Network ; September 2015", "Test SDF Network ; September 2015"),
    true
  );
  assert.equal(isExpectedNetwork("Public Global Stellar Network ; September 2015", "Test SDF Network ; September 2015"), false);
  assert.equal(isExpectedNetwork(null, "Test SDF Network ; September 2015"), true);
});

test("chosen wallet and address round-trip through storage", () => {
  const store = fakeStorage();
  storeWallet("xbull", "G_XBULL", store);
  assert.deepEqual(readStoredWallet(store), { id: "xbull", address: "G_XBULL" });
  assert.equal(store.getItem(WALLET_STORAGE_KEY), "xbull");
  assert.equal(store.getItem(walletAddressKey("xbull")), "G_XBULL");

  storeWallet("xbull", undefined, store);
  assert.equal(readStoredWallet(store).address, "G_XBULL");

  clearStoredWallet(store);
  assert.equal(readStoredWallet(store), null);
});

test("legacy connected flag migrates to the Freighter adapter id", () => {
  const store = fakeStorage({ [LEGACY_WALLET_STORAGE_KEY]: "1" });
  assert.deepEqual(readStoredWallet(store), { id: "freighter", address: null });
  assert.equal(store.getItem(WALLET_STORAGE_KEY), "freighter");
  assert.equal(store.getItem(LEGACY_WALLET_STORAGE_KEY), null);
});

test("invalid stored wallet ids are ignored", () => {
  const store = fakeStorage({ [WALLET_STORAGE_KEY]: "not-a-wallet" });
  assert.equal(readStoredWallet(store), null);
});
