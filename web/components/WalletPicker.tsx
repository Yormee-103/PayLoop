"use client";

import { WALLET_OPTIONS } from "@/lib/wallet";
import { Modal } from "./Modal";
import { Spinner } from "./ui";
import { useWallet } from "./WalletProvider";

// Wallet selection lives in one place so every "Connect wallet" button opens
// the same picker. The last persisted adapter is highlighted, which makes
// disconnect → reconnect restore the right adapter obvious.
export function WalletPicker() {
  const {
    pickerOpen,
    closeWalletPicker,
    connect,
    connecting,
    walletId,
    error,
  } = useWallet();

  return (
    <Modal
      open={pickerOpen}
      onClose={closeWalletPicker}
      title="Connect a wallet"
      description="Choose the Stellar wallet you want to use for this session."
    >
      <div className="space-y-2" role="list" aria-label="Supported wallets">
        {WALLET_OPTIONS.map((option) => {
          const isLastUsed = option.id === walletId;
          return (
            <div key={option.id} role="listitem">
              <button
                type="button"
                disabled={connecting}
                onClick={() => {
                  void connect(option.id).then((ok) => {
                    if (ok) closeWalletPicker();
                  });
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:border-brand-400/50 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>
                  <span className="block font-semibold">{option.name}</span>
                  <span className="block text-xs text-slate-400">
                    {isLastUsed ? "Last used" : "Stellar wallet"}
                  </span>
                </span>
                <span className="flex items-center gap-2 text-sm text-brand-300">
                  {connecting ? <Spinner /> : null}
                  Connect
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}

      <p className="text-xs text-slate-500">
        You can change wallets at any time by disconnecting and connecting again.
      </p>
    </Modal>
  );
}
