export class PayLoopError extends Error {
  code?: string | number;
  txHash?: string;
  isTimeout?: boolean;

  constructor(
    message: string,
    options?: { code?: string | number; txHash?: string; isTimeout?: boolean }
  ) {
    super(message);
    this.name = "PayLoopError";
    this.code = options?.code;
    this.txHash = options?.txHash;
    this.isTimeout = options?.isTimeout;
  }
}

export const CONTRACT_ERROR_MESSAGES: Record<number, string> = {
  1: "The contract is not initialized. Please try again later or contact support.",
  2: "Contract already initialized.",
  3: "Invoice not found. Please verify the invoice ID and try again.",
  4: "This invoice has already been paid.",
  5: "Invalid invoice amount. The amount must be greater than zero.",
  6: "Please provide a valid description for the invoice.",
  7: "The freelancer and client addresses cannot be the same.",
  8: "Your wallet does not have enough token balance to complete this payment.",
};

/**
 * Maps contract and wallet transaction errors to human-readable plain language.
 */
export function mapErrorMessage(error: unknown, txHash?: string): string {
  if (!error) return "An unexpected error occurred.";
  if (error instanceof PayLoopError) return error.message;

  const msg =
    typeof error === "string" ? error : (error as any)?.message ?? String(error);

  // 1. Contract error codes 1-8: e.g. "Error(Contract, #4)", "Error(Contract, 4)", "contract error: 4"
  const contractMatch =
    msg.match(/Error\(Contract,\s*#?([1-8])\)/i) ||
    msg.match(/contract\s+error:?\s*#?([1-8])\b/i);
  if (contractMatch) {
    const code = Number(contractMatch[1]);
    if (CONTRACT_ERROR_MESSAGES[code]) {
      return CONTRACT_ERROR_MESSAGES[code];
    }
  }

  // 2. Timeout: A timeout never claims the transaction failed
  if (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("NOT_FOUND")
  ) {
    const hashNotice = txHash
      ? ` Transaction hash: ${txHash}. Check the explorer before retrying.`
      : " Please check the explorer before retrying.";
    return `Transaction confirmation timed out. The network is taking longer than expected to confirm.${hashNotice}`;
  }

  // 3. User rejected signing in wallet
  if (
    msg.includes("User declined") ||
    msg.includes("User rejected") ||
    msg.includes("rejected the request") ||
    msg.includes("declined signing") ||
    msg.includes("cancelled")
  ) {
    return "Transaction was cancelled: signing request was rejected in your wallet.";
  }

  // 4. Insufficient XLM for transaction fees
  if (
    msg.includes("tx_insufficient_fee") ||
    msg.includes("tx_insufficient_balance") ||
    msg.includes("insufficient XLM") ||
    (msg.includes("insufficient balance") && !msg.includes("token"))
  ) {
    return "Insufficient XLM in your wallet to cover Stellar network transaction fees.";
  }

  // 5. Missing trustline
  if (
    msg.includes("trustline entry is missing") ||
    msg.includes("missing trustline") ||
    msg.includes("op_no_trust")
  ) {
    return "Missing token trustline. The recipient has not enabled the payment token yet.";
  }

  // 6. Generic on-chain failure
  if (msg.includes("Transaction did not succeed (status: FAILED)")) {
    return "The transaction failed on-chain. Please verify your wallet balance, network connection, and parameters.";
  }

  return msg || "An unexpected error occurred.";
}
