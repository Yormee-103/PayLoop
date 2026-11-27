// Builds the contract call used to fund an invoice. Kept separate from
// contract.ts so entrypoint selection can be unit tested without a wallet or
// a live RPC connection.
import { Address, nativeToScVal, xdr } from "@stellar/stellar-sdk";

export interface FundInvoiceCall {
  method: "fund_invoice" | "fund_invoice_as_payer";
  args: xdr.ScVal[];
}

export function buildFundInvoiceCall(
  payerAddress: string,
  invoiceId: string,
  thirdParty = false,
): FundInvoiceCall {
  const id = nativeToScVal(BigInt(invoiceId), { type: "u64" });
  return thirdParty
    ? {
        method: "fund_invoice_as_payer",
        args: [id, new Address(payerAddress).toScVal()],
      }
    : { method: "fund_invoice", args: [id] };
}
