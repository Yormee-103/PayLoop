"use client";

import { useState } from "react";
import Link from "next/link";
import { useWallet } from "@/components/WalletProvider";
import { Alert, Spinner, TxLink } from "@/components/ui";
import { createInvoice } from "@/lib/contract";
import { toBaseUnits } from "@/lib/format";
import { config, isConfigured } from "@/lib/config";

type Result = { id: string; hash: string };

export default function CreatePage() {
  const { address, connect, connecting } = useWallet();
  const [client, setClient] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const configured = isConfigured();

  function validate(): string | null {
    if (!client.startsWith("G") || client.length !== 56) {
      return "Enter a valid client Stellar address (starts with G, 56 chars).";
    }
    if (client === address) {
      return "The client can't be your own address.";
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      return "Enter an amount greater than zero.";
    }
    if (!description.trim()) {
      return "Add a short description of the work.";
    }
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    if (!address) {
      setError("Connect your wallet first.");
      return;
    }
    setSubmitting(true);
    try {
      const dueUnix = dueDate
        ? BigInt(Math.floor(new Date(dueDate).getTime() / 1000))
        : 0n;
      const res = await createInvoice({
        freelancer: address,
        client,
        amount: toBaseUnits(amount),
        description: description.trim(),
        dueDate: dueUnix,
      });
      setResult(res);
      setClient("");
      setAmount("");
      setDescription("");
      setDueDate("");
    } catch (e: any) {
      setError(e?.message ?? "Failed to create invoice.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!configured) {
    return (
      <Alert kind="info">
        The contract isn&apos;t configured yet. Set{" "}
        <code>NEXT_PUBLIC_CONTRACT_ID</code> and{" "}
        <code>NEXT_PUBLIC_TOKEN_ID</code> in your environment.
      </Alert>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New invoice</h1>
        <p className="mt-1 text-sm text-slate-400">
          You are the freelancer. The invoice is recorded on-chain and your
          client funds it in {config.tokenSymbol}.
        </p>
      </div>

      {result && (
        <Alert kind="success">
          <p className="font-semibold">Invoice #{result.id} created.</p>
          <p className="mt-1">
            Share the payment link with your client:{" "}
            <Link
              href={`/pay/${result.id}`}
              className="text-brand-200 underline"
            >
              /pay/{result.id}
            </Link>
          </p>
          <p className="mt-1">
            <TxLink hash={result.hash} />
          </p>
        </Alert>
      )}

      {error && <Alert kind="error">{error}</Alert>}

      {!address ? (
        <div className="card flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-slate-300">
            Connect your wallet to create an invoice.
          </p>
          <button
            onClick={connect}
            disabled={connecting}
            className="btn-primary"
          >
            {connecting ? "Connecting…" : "Connect wallet"}
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="card space-y-4">
          <div>
            <label className="label" htmlFor="client">
              Client wallet address
            </label>
            <input
              id="client"
              className="input font-mono text-xs"
              placeholder="GABC…"
              value={client}
              onChange={(e) => setClient(e.target.value.trim())}
              autoComplete="off"
            />
          </div>

          <div>
            <label className="label" htmlFor="amount">
              Amount ({config.tokenSymbol})
            </label>
            <input
              id="amount"
              className="input"
              inputMode="decimal"
              placeholder="1500.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="description">
              Description
            </label>
            <input
              id="description"
              className="input"
              placeholder="Brand website redesign"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={120}
            />
          </div>

          <div>
            <label className="label" htmlFor="due">
              Due date <span className="text-slate-500">(optional)</span>
            </label>
            <input
              id="due"
              type="date"
              className="input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full"
          >
            {submitting ? (
              <>
                <Spinner /> Creating invoice…
              </>
            ) : (
              "Create invoice"
            )}
          </button>
          <p className="text-center text-xs text-slate-500">
            You&apos;ll approve one transaction in Freighter to record the
            invoice.
          </p>
        </form>
      )}
    </div>
  );
}
