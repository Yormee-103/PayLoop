import test from "node:test";
import assert from "node:assert/strict";
import { Address, scValToNative } from "@stellar/stellar-sdk";
import { buildFundInvoiceCall } from "../fund-invoice-call.ts";

const CLIENT = "GDYPHJ7H2DO6OUWD5ZJRLFT57QNUZYOWBBYEHEQBAGJDFBAAFJWMXSNU";
const TREASURY = "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI";

test("the default path calls fund_invoice with only the invoice id", () => {
  const call = buildFundInvoiceCall(CLIENT, "42");

  assert.equal(call.method, "fund_invoice");
  assert.equal(call.args.length, 1);
  assert.equal(scValToNative(call.args[0]), 42n);
});

test("a third-party payer calls the dedicated entrypoint with their address", () => {
  const call = buildFundInvoiceCall(TREASURY, "42", true);

  assert.equal(call.method, "fund_invoice_as_payer");
  assert.equal(call.args.length, 2);
  assert.equal(scValToNative(call.args[0]), 42n);
  assert.equal(Address.fromScVal(call.args[1]).toString(), TREASURY);
});
