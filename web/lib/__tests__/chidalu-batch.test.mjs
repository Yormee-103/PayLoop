import test from "node:test";
import assert from "node:assert/strict";
import { deriveClientInvoices } from "../client-invoices.ts";
import { isInvoiceOverdue } from "../invoice-status.ts";
import {
  applyWalletChange,
  isWrongNetwork,
} from "../wallet-state.ts";
import {
  getFocusableElements,
  modalAriaProps,
  nextFocusIndex,
} from "../modal-a11y.ts";

const NOW = 1_700_000_000_000;

const invoice = (overrides = {}) => ({
  id: "1",
  status: "Pending",
  amount: 100n,
  client: "GCLIENT",
  freelancer: "GFREELANCER",
  dueDate: 0n,
  createdAt: 1n,
  ...overrides,
});

test("client summary keeps only pending invoices billed to the address", () => {
  const scanned = [
    invoice({ id: "1", createdAt: 1n }),
    invoice({ id: "2", client: "GOTHER", amount: 900n, createdAt: 2n }),
    invoice({ id: "3", status: "Paid", amount: 700n, createdAt: 3n }),
    invoice({ id: "4", amount: 250n, createdAt: 4n, dueDate: BigInt(NOW / 1000 - 60) }),
  ];

  const result = deriveClientInvoices(scanned, "GCLIENT", NOW);

  assert.deepEqual(result.invoices.map((item) => item.id), ["4", "1"]);
  assert.equal(result.count, 2);
  assert.equal(result.totalOwed, 350n);
  assert.equal(result.overdueCount, 1);
});

test("client summary is empty without a connected address", () => {
  const result = deriveClientInvoices([invoice()], null, NOW);
  assert.deepEqual(result.invoices, []);
  assert.equal(result.count, 0);
  assert.equal(result.totalOwed, 0n);
});

test("overdue rule covers pending, dated deadlines only", () => {
  assert.equal(isInvoiceOverdue(invoice({ dueDate: BigInt(NOW / 1000 - 1) }), NOW), true);
  assert.equal(isInvoiceOverdue(invoice({ dueDate: BigInt(NOW / 1000 + 60) }), NOW), false);
  assert.equal(isInvoiceOverdue(invoice(), NOW), false);
  assert.equal(
    isInvoiceOverdue(invoice({ status: "Paid", dueDate: 1n }), NOW),
    false
  );
});

const wallet = {
  address: "GOLD",
  network: "TESTNET",
  networkPassphrase: "Test SDF Network ; September 2015",
  installed: true,
};

test("wallet watch applies account and network changes", () => {
  const account = applyWalletChange(wallet, {
    address: "GNEW",
    network: "TESTNET",
    networkPassphrase: "Test SDF Network ; September 2015",
  });
  assert.equal(account.next.address, "GNEW");
  assert.equal(account.connected, true);
  assert.equal(account.changed, true);

  const network = applyWalletChange(wallet, {
    address: "GOLD",
    network: "PUBLIC",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
  });
  assert.equal(network.next.network, "PUBLIC");
  assert.equal(isWrongNetwork(network.next.networkPassphrase), true);
});

test("wallet watch clears state on disconnect and ignores RPC errors", () => {
  const cleared = applyWalletChange(wallet, {
    address: "",
    network: "",
    networkPassphrase: "",
  });
  assert.equal(cleared.next.address, null);
  assert.equal(cleared.next.networkPassphrase, null);
  assert.equal(cleared.connected, false);

  const failed = applyWalletChange(wallet, {
    address: "",
    network: "",
    networkPassphrase: "",
    error: { message: "offline" },
  });
  assert.equal(failed.next, wallet);
  assert.equal(failed.changed, false);
  assert.equal(isWrongNetwork(wallet.networkPassphrase), false);
});

test("modal focus helpers wrap and label the dialog", () => {
  assert.equal(nextFocusIndex(3, 2, false), 0);
  assert.equal(nextFocusIndex(3, 0, true), 2);
  assert.equal(nextFocusIndex(3, -1, false), 0);
  assert.equal(nextFocusIndex(0, 0, false), -1);
  assert.deepEqual(modalAriaProps("title-1"), {
    role: "dialog",
    "aria-modal": true,
    "aria-labelledby": "title-1",
  });

  const hidden = { getAttribute: () => "true" };
  const visible = { getAttribute: () => null };
  const root = { querySelectorAll: () => [visible, hidden] };
  assert.deepEqual(getFocusableElements(root), [visible]);
});
