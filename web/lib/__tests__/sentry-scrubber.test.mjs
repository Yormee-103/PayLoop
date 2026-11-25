import test from "node:test";
import assert from "node:assert/strict";
import {
  scrubStellarAddresses,
  scrubBreadcrumb,
  scrubEvent,
} from "../sentry-scrubber.ts";

test("scrubStellarAddresses replaces G... public keys", () => {
  const address = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
  const raw = `https://payloop.app/invoices/${address}?ref=test`;
  const scrubbed = scrubStellarAddresses(raw);
  assert.equal(
    scrubbed,
    "https://payloop.app/invoices/[SCRUBBED_ADDRESS]?ref=test",
  );
});

test("scrubStellarAddresses replaces C... contract addresses", () => {
  const contractId = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";
  const raw = `https://horizon-testnet.stellar.org/contracts/${contractId}/state`;
  const scrubbed = scrubStellarAddresses(raw);
  assert.equal(
    scrubbed,
    "https://horizon-testnet.stellar.org/contracts/[SCRUBBED_ADDRESS]/state",
  );
});

test("scrubBreadcrumb scrubs message and data fields", () => {
  const address = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
  const breadcrumb = {
    message: `User connected wallet ${address}`,
    data: {
      url: `/account/${address}`,
      status: "ok",
    },
  };
  const scrubbed = scrubBreadcrumb(breadcrumb);
  assert.equal(scrubbed.message, "User connected wallet [SCRUBBED_ADDRESS]");
  assert.equal(scrubbed.data.url, "/account/[SCRUBBED_ADDRESS]");
  assert.equal(scrubbed.data.status, "ok");
});

test("scrubEvent scrubs request url, query string, transaction and breadcrumbs", () => {
  const address = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
  const event = {
    request: {
      url: `https://payloop.app/api/invoices?payer=${address}`,
      query_string: `payer=${address}&limit=10`,
      data: `{"recipient":"${address}"}`,
    },
    transaction: `/invoice/${address}`,
    message: `Payment failed for ${address}`,
    breadcrumbs: [
      {
        message: `Navigated to ${address}`,
      },
    ],
  };

  const scrubbed = scrubEvent(event);
  assert.equal(
    scrubbed.request.url,
    "https://payloop.app/api/invoices?payer=[SCRUBBED_ADDRESS]",
  );
  assert.equal(
    scrubbed.request.query_string,
    "payer=[SCRUBBED_ADDRESS]&limit=10",
  );
  assert.equal(scrubbed.request.data, '{"recipient":"[SCRUBBED_ADDRESS]"}');
  assert.equal(scrubbed.transaction, "/invoice/[SCRUBBED_ADDRESS]");
  assert.equal(scrubbed.message, "Payment failed for [SCRUBBED_ADDRESS]");
  assert.equal(
    scrubbed.breadcrumbs[0].message,
    "Navigated to [SCRUBBED_ADDRESS]",
  );
});
