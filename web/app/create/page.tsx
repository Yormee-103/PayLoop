"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/components/WalletProvider";
import { Alert, Spinner, TxLink } from "@/components/ui";
import { InvoicePreview } from "@/components/InvoiceDocument";
import { createInvoice, getAllowedTokenIds } from "@/lib/contract";
import { toBaseUnits } from "@/lib/format";
import { clientAddressError } from "@/lib/stellar-address";
import { config, getTokenConfig, isConfigured, tokens } from "@/lib/config";
import { useTokenMeta } from "@/lib/use-token-meta";
import {
  BUILTIN_TEMPLATES,
  deleteCustomTemplate,
  loadCustomTemplates,
  saveCustomTemplate,
  type InvoiceTemplate,
} from "@/lib/templates";

type Result = { id: string; hash: string };

export default function CreatePage() {
  const { address, connect, connecting } = useWallet();
  const [client, setClient] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  // Set after mount so the server-rendered markup and the first client render
  // match (the server's "today" can differ from the user's local date).
  const [today, setToday] = useState("");
  useEffect(() => setToday(todayDateInputValue()), []);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [customTemplates, setCustomTemplates] = useState<InvoiceTemplate[]>(() =>
    loadCustomTemplates()
  );
  const [templateName, setTemplateName] = useState("");
  const [tokenId, setTokenId] = useState(config.tokenId);
  const [availableTokens, setAvailableTokens] = useState(() => tokens);
  const token = useTokenMeta(tokenId);

  const configured = isConfigured();

  useEffect(() => {
    let active = true;
    getAllowedTokenIds()
      .then((ids) => {
        if (!active) return;
        const merged = ids.map((id) => getTokenConfig(id));
        setAvailableTokens(merged);
        if (ids.length > 0 && !ids.includes(tokenId)) setTokenId(ids[0]);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [tokenId]);

  function validate(): string | null {
    const clientError = clientAddressError(client);
    if (clientError) return clientError;
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
    // Issue #66: an empty due date is fine; a date before today is not.
    const dueErr = dueDateError(dueDate);
    if (dueErr) return dueErr;
    return null;
  }

  function applyTemplate(id: string) {
    const template = [...BUILTIN_TEMPLATES, ...customTemplates].find(
      (t) => t.id === id
    );
    if (!template) return;
    setDescription(template.description);
    setAmount(template.amount);
    setError(null);
  }

  function saveTemplate() {
    if (!description.trim()) {
      setError("Add a description before saving it as a template.");
      return;
    }
    const name = templateName.trim() || description.trim().slice(0, 24);
    setCustomTemplates(saveCustomTemplate(name, description, amount));
    setTemplateName("");
    setError(null);
  }

  const previewInvoice = useMemo(
    () =>
      client && description && Number(amount) > 0
        ? {
            id: "—",
            freelancer: address ?? "",
            client,
            token: tokenId,
            amount: toBaseUnits(amount, token.decimals),
            description: description.trim(),
            dueDate: dueDate
              ? BigInt(Math.floor(new Date(dueDate).getTime() / 1000))
              : 0n,
            status: "Pending" as const,
            createdAt: 0n,
            paidAt: 0n,
          }
        : null,
    [client, amount, description, dueDate, address, tokenId, token.decimals]
  );

  function openPreview() {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    if (!address) {
      setError("Connect your wallet first.");
      return;
    }
    setError(null);
    setPreview(true);
  }

  async function onSubmit() {
    setPreview(false);
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
    setError(null);
    try {
      const dueUnix = dueDate
        ? BigInt(Math.floor(new Date(dueDate).getTime() / 1000))
        : 0n;
      const res = await createInvoice({
        freelancer: address,
        client,
        amount: toBaseUnits(amount, token.decimals),
        description: description.trim(),
        dueDate: dueUnix,
        token: tokenId,
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
          client funds it in the token you choose below.
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
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="card space-y-4"
        >
          <div>
            <label className="label" htmlFor="template">
              Start from a template
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                id="template"
                className="input flex-1"
                value=""
                onChange={(e) => e.target.value && applyTemplate(e.target.value)}
              >
                <option value="">Choose a template…</option>
                <optgroup label="Built-in">
                  {BUILTIN_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
                {customTemplates.length > 0 && (
                  <optgroup label="My templates">
                    {customTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Save current as template"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  maxLength={40}
                  aria-label="Template name"
                />
                <button
                  type="button"
                  onClick={saveTemplate}
                  className="btn-ghost shrink-0"
                >
                  Save
                </button>
              </div>
            </div>
            {customTemplates.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {customTemplates.map((t) => (
                  <span key={t.id} className="badge bg-brand-500/15 text-brand-200">
                    {t.name}
                    <button
                      type="button"
                      onClick={() =>
                        setCustomTemplates(deleteCustomTemplate(t.id))
                      }
                      className="ml-1 text-brand-300/70 hover:text-brand-100"
                      aria-label={`Delete template ${t.name}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="mt-1.5 text-xs text-slate-500">
              Templates prefill the description and amount. Your saved
              templates stay in this browser.
            </p>
          </div>

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
            {client.length > 0 && !clientAddressError(client) && (
              <p className="mt-1 text-sm text-emerald-300" role="status">
                Client address is valid.
              </p>
            )}
          </div>

          {availableTokens.length > 1 && (
            <div>
              <label className="label" htmlFor="token">
                Payment token
              </label>
              <select
                id="token"
                className="input"
                value={tokenId}
                onChange={(e) => setTokenId(e.target.value)}
              >
                {availableTokens.map((t) => (
                  <option key={t.id} value={t.id}>
                    {getTokenConfig(t.id).symbol}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Only tokens allowed by the contract can be selected. This
                choice is fixed once the invoice is created.
              </p>
            </div>
          )}

          <div>
            <label className="label" htmlFor="amount">
              Amount ({token.symbol})
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
              min={today || undefined}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              aria-invalid={dueDateError(dueDate) ? true : undefined}
              aria-describedby={dueDateError(dueDate) ? "due-error" : undefined}
            />
            {dueDateError(dueDate) && (
              <p id="due-error" role="alert" className="mt-1 text-xs text-red-300">
                {dueDateError(dueDate)}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={openPreview}
              className="btn-ghost flex-1"
            >
              👀 Preview invoice
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex-1"
            >
              {submitting ? (
                <>
                  <Spinner /> Creating invoice…
                </>
              ) : (
                "Create invoice"
              )}
            </button>
          </div>
          <p className="text-center text-xs text-slate-500">
            You&apos;ll approve one transaction in Freighter to record the
            invoice.
          </p>
        </form>
      )}

      <InvoicePreview
        invoice={previewInvoice}
        open={preview && Boolean(previewInvoice)}
        onClose={() => setPreview(false)}
        onConfirm={onSubmit}
        confirming={submitting}
      />
    </div>
  );
}
