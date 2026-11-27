"use client";

import { useWallet } from "./WalletProvider";

// Shared "connect your wallet" prompt shown by pages that require a connected
// wallet before revealing their content.
export function ConnectPrompt({
  title,
  message,
  className = "py-10",
  messageClassName = "text-slate-300",
}: {
  title?: string;
  message: string;
  className?: string;
  messageClassName?: string;
}) {
  const { openWalletPicker, connecting } = useWallet();
  return (
    <div
      className={`card flex flex-col items-center gap-4 text-center ${className}`}
    >
      {title && <h1 className="text-xl font-bold">{title}</h1>}
      <p className={messageClassName}>{message}</p>
      <button onClick={openWalletPicker} disabled={connecting} className="btn-primary">
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
    </div>
  );
}
