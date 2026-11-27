// Wallet errors are deliberately rewritten before they reach React. Raw SDK
// errors often name a specific wallet or leak implementation details, which
// breaks the wallet-agnostic UX promised by issue #34.

export type WalletAction =
  | "connect"
  | "detect"
  | "sign"
  | "network"
  | "disconnect";

export const WALLET_NOT_FOUND_MESSAGE =
  "Wallet not found. Install or enable a supported wallet, then try again.";
export const WALLET_DECLINED_MESSAGE =
  "Wallet request was declined. Try again when you're ready.";
export const WRONG_NETWORK_MESSAGE =
  "Your wallet is on a different Stellar network. Switch to the required network and try again.";
export const WALLET_SIGN_MESSAGE =
  "The transaction could not be signed. Try again.";
export const WALLET_CONNECT_MESSAGE =
  "The wallet could not be connected. Try again.";
export const WALLET_GENERIC_MESSAGE = "Wallet request failed. Try again.";

function causeMessage(cause: unknown): string {
  if (typeof cause === "string") return cause;
  if (cause && typeof cause === "object") {
    const value = (cause as { message?: unknown; error?: unknown }).message;
    if (typeof value === "string" && value) return value;
    const nested = (cause as { error?: unknown }).error;
    if (nested && typeof nested === "object") {
      const nestedMessage = (nested as { message?: unknown }).message;
      if (typeof nestedMessage === "string" && nestedMessage) return nestedMessage;
    }
  }
  return "";
}

export function walletErrorMessage(
  cause: unknown,
  action: WalletAction = "connect"
): string {
  const raw = causeMessage(cause).toLowerCase();

  if (/different network|wrong network|network mismatch|networkpassphrase/.test(raw)) {
    return WRONG_NETWORK_MESSAGE;
  }
  if (/not found|not installed|not available|install|missing|no wallet/.test(raw)) {
    return WALLET_NOT_FOUND_MESSAGE;
  }
  if (/declin|reject|cancel|denied|user refused/.test(raw)) {
    return WALLET_DECLINED_MESSAGE;
  }

  switch (action) {
    case "sign":
      return WALLET_SIGN_MESSAGE;
    case "network":
      return WRONG_NETWORK_MESSAGE;
    case "connect":
      return WALLET_CONNECT_MESSAGE;
    default:
      return WALLET_GENERIC_MESSAGE;
  }
}
