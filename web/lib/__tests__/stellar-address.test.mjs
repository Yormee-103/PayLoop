import test from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@stellar/stellar-sdk";
import { clientAddressError } from "../stellar-address.ts";

test("accepts a valid Ed25519 account address", () => {
  assert.equal(clientAddressError(Keypair.random().publicKey()), null);
});

test("rejects a checksum typo", () => {
  const address = Keypair.random().publicKey();
  const typo = `${address.slice(0, -1)}${address.endsWith("A") ? "B" : "A"}`;
  assert.match(clientAddressError(typo) ?? "", /checksum|valid Stellar/i);
});

test("explains unsupported muxed and contract addresses", () => {
  assert.match(clientAddressError("M" + "A".repeat(55)) ?? "", /Muxed/);
  assert.match(clientAddressError("C" + "A".repeat(55)) ?? "", /Contract/);
});
