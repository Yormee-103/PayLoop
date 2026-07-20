"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/components/WalletProvider";
import { Alert, Spinner, StatusBadge, TxLink } from "@/components/ui";
import { TrustlineButton } from "@/components/TrustlineButton";
import { FaucetButton } from "@/components/FaucetButton";
import {
  fundInvoice,
  getInvoice,
  getTokenBalance,
  hasUsdcTrustline,
  type Invoice,
} from "@/lib/contract";
import { formatAmount, formatDate, shortAddress } from "@/lib/format";
import { config, isConfigured } from "@/lib/config";

export default function PayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { address, connect, connecting } = useWallet();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paidHash, setPaidHash] = useState<string | null>(null);
  const [trusted, setTrusted] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const inv = await getInvoice(id);
      if (!inv) {
        setNotFound(true);
      } else {
        setInvoice(inv);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load invoice.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!address) {
      setTrusted(null);
      return;
    }
    getTokenBalance(address).then(setBalance).catch(() => {});
    hasUsdcTrustline(address).then(setTrusted).catch(() => setTrusted(null));
  }, [address, paidHash]);

  async function pay() {
    if (!address || !invoice) return;
    setError(null);
    setPaying(true);
    try {
      const res = await fundInvoice(address, invoice.id);
      setPaidHash(res.hash);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Payment failed.");
    } finally {
      setPaying(false);
    }
  }

  if (!isConfigured()) {
    return (
      <Alert kind="info">
        The contract isn&apos;t configured yet.
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="card h-64 animate-pulse bg-white/5" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-lg">
        <Alert kind="error">
          Invoice #{id} doesn&apos;t exist.{" "}
          <Link href="/dashboard" className="underline">
            Go to dashboard
          </Link>
        </Alert>
      </div>
    );
  }

  if (!invoice) return null;

  const isClient = address === invoice.client;
  const isPaid = invoice.status === "Paid";
  const insufficient =
    balance !== null && balance < invoice.amount && isClient && !isPaid;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Invoice #{invoice.id}</h1>
        <p className="mt-1 text-sm text-slate-400">
          Payment request from {shortAddress(invoice.freelancer)}
        </p>
      </div>

      <div className="card space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Amount due</span>
          <StatusBadge status={invoice.status} />
        </div>
        <div className="text-center">
          <div className="text-4xl font-bold">
            {formatAmount(invoice.amount)}
          </div>
          <div className="mt-1 text-slate-400">{config.tokenSymbol}</div>
        </div>

        <div className="space-y-2 rounded-lg bg-ink-900/60 p-4 text-sm">
          <Row label="Description" value={invoice.description || "—"} />
          <Row label="From (freelancer)" value={shortAddress(invoice.freelancer)} mono />
          <Row label="To (client)" value={shortAddress(invoice.client)} mono />
          {invoice.dueDate > 0n && (
            <Row label="Due date" value={formatDate(invoice.dueDate)} />
          )}
          {isPaid && (
            <Row label="Paid on" value={formatDate(invoice.paidAt)} />
          )}
        </div>

        {(paidHash || isPaid) && (
          <Alert kind="success">
            <p className="font-semibold">Payment complete 🎉</p>
            <p className="mt-1">
              {formatAmount(invoice.amount)} {config.tokenSymbol} was sent to the
              freelancer.
            </p>
            {paidHash && (
              <p className="mt-1">
                <TxLink hash={paidHash} />
              </p>
            )}
          </Alert>
        )}

        {error && <Alert kind="error">{error}</Alert>}

        {!isPaid && (
          <>
            {!address ? (
              <button
                onClick={connect}
                disabled={connecting}
                className="btn-primary w-full"
              >
                {connecting ? "Connecting…" : "Connect wallet to pay"}
              </button>
            ) : !isClient ? (
              <Alert kind="info">
                This invoice is addressed to {shortAddress(invoice.client)}.
                Connect that wallet to pay it.
              </Alert>
            ) : trusted === false ? (
              <TrustlineButton onDone={() => setTrusted(true)} />
            ) : (
              <>
                {insufficient && (
                  <Alert kind="info">
                    <p>
                      Your balance is {formatAmount(balance ?? 0n)}{" "}
                      {config.tokenSymbol}, but this invoice is for{" "}
                      {formatAmount(invoice.amount)} {config.tokenSymbol}. Grab
                      test {config.tokenSymbol} to continue:
                    </p>
                    <div className="mt-2">
                      <FaucetButton
                        onDone={() =>
                          getTokenBalance(address)
                            .then(setBalance)
                            .catch(() => {})
                        }
                      />
                    </div>
                  </Alert>
                )}
                <button
                  onClick={pay}
                  disabled={paying || insufficient}
                  className="btn-primary w-full"
                >
                  {paying ? (
                    <>
                      <Spinner /> Paying…
                    </>
                  ) : (
                    `Pay ${formatAmount(invoice.amount)} ${config.tokenSymbol}`
                  )}
                </button>
                <p className="text-center text-xs text-slate-500">
                  Funds transfer directly to the freelancer on-chain.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={mono ? "font-mono text-xs" : ""}>{value}</span>
    </div>
  );
}
