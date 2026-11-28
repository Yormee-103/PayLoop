"use client";

import { useWallet } from "./WalletProvider";
import { Alert } from "./ui";

// Persistent warning while Freighter is on a different network. Write actions
// on Create and Pay are disabled in their own components.
export function WrongNetworkBanner() {
  const { wrongNetwork } = useWallet();
  if (!wrongNetwork) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4" role="region" aria-label="Network warning">
      <Alert kind="error">
        <p className="font-semibold">Switch Freighter to Testnet</p>
        <p className="mt-1">
          PayLoop is running on the Stellar testnet. Creating and paying invoices
          is disabled until your wallet matches.
        </p>
      </Alert>
    </div>
  );
}
