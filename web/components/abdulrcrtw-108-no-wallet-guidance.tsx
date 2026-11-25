"use client";

export type NoWalletGuidanceProps = {
  installed?: boolean;
  network?: string | null;
  networkLabel?: string;
  walletInstallUrl?: string;
  connecting?: boolean;
  onConnect?: () => void;
  className?: string;
};

const DEFAULT_WALLET_URL = "https://www.freighter.app/";

export function NoWalletGuidance({
  installed = true,
  network = "TESTNET",
  networkLabel,
  walletInstallUrl = DEFAULT_WALLET_URL,
  connecting = false,
  onConnect,
  className = "",
}: NoWalletGuidanceProps) {
  if (installed) return null;

  const label = networkLabel ?? (network === "TESTNET" ? "Stellar testnet" : network || "the expected network");

  return (
    <section
      aria-labelledby="no-wallet-guidance-title"
      className={`card space-y-4 p-5 text-sm text-slate-200 ${className}`}
    >
      <div>
        <h2 id="no-wallet-guidance-title" className="text-base font-semibold">
          Install a wallet to pay this invoice
        </h2>
        <p className="mt-1 text-slate-400">
          You can pay with a Stellar wallet extension. It only takes a minute.
        </p>
      </div>

      <ol className="space-y-2">
        <li>
          <span className="font-semibold">1. Install a wallet.</span>{" "}
          <a
            href={walletInstallUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Get Freighter
          </a>{" "}
          or another Stellar wallet that supports Soroban.
        </li>
        <li>
          <span className="font-semibold">2. Create or import an account.</span>{" "}
          Keep your recovery phrase private; PayLoop will never ask for it.
        </li>
        <li>
          <span className="font-semibold">3. Return here and connect.</span>{" "}
          Your wallet will ask you to approve the connection and the payment.
        </li>
      </ol>

      <p className="rounded-lg bg-slate-900/60 p-3 text-xs text-slate-400">
        This payment uses {label}. If your wallet is on a different network, switch it before connecting.
      </p>

      {onConnect ? (
        <button
          type="button"
          onClick={onConnect}
          disabled={connecting}
          className="btn-primary w-full"
        >
          {connecting ? "Connecting…" : "Connect wallet"}
        </button>
      ) : null}
    </section>
  );
}
