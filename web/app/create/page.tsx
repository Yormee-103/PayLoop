"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/components/WalletProvider";
import { ConnectPrompt } from "@/components/ConnectPrompt";
import { Alert, Spinner, TxLink } from "@/components/ui";
import { InvoicePreview } from "@/components/InvoiceDocument";
import { createInvoice, getAllowedTokenIds } from "@/lib/contract";
import { errorMessage } from "@/lib/async-resource";
import {
  dueDateError,
  dueDateToUnix,
  todayDateInputValue,
} from "@/lib/invoice-helpers";
import { toBaseUnits } from "@/lib/format";
import { dueDateError, todayDateInputValue } from "@/lib/invoice-helpers";
import { config, getTokenConfig, isConfigured, tokens } from "@/lib/config";
import { useTokenMeta } from "@/lib/use-token-meta";
import { trackEvent } from "@/lib/analytics";
import { StrKey } from "@stellar/stellar-sdk";
import {
  getSafeSessionStorageItem,
  removeSafeSessionStorageItem,
  setSafeSessionStorageItem,
} from "@/lib/safe-storage";
import {
  BUILTIN_TEMPLATES,
  deleteCustomTemplate,
  loadCustomTemplates,
  saveCustomTemplate,
  type InvoiceTemplate,
} from "@/lib/templates";
import {
  deleteSavedClient,
  loadSavedClients,
  renameSavedClient,
  saveClient,
  type SavedClient,
} from "@/lib/clients";

type Result = { id: string; hash: string };
const DRAFT_STORAGE_KEY = "payloop.create.draft";

export default function CreatePage() {
  const { address, wrongNetwork } = useWallet();
  const [client, setClient] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [tokenId, setTokenId] = useState(config.tokenId);
  const [availableTokens, setAvailableTokens] = useState(() => tokens);
  const [draftRestored, setDraftRestored] = useState(false);
  // Set after mount so the server-rendered markup and the first client render
  // match (the server's "today" can differ from the user's local date).
  const [today, setToday] = useState("");
  useEffect(() => setToday(todayDateInputValue()), []);
  useEffect(() => {
    const raw = getSafeSessionStorageItem(DRAFT_STORAGE_KEY);
    if (raw) {
      try {
        const draft = JSON.parse(raw);
        if (draft && typeof draft === "object") {
          if (typeof draft.client === "string") setClient(draft.client);
          if (typeof draft.amount === "string") setAmount(draft.amount);
          if (typeof draft.description === "string") {
            setDescription(draft.description);
          }
          if (typeof draft.dueDate === "string") setDueDate(draft.dueDate);
          if (
            typeof draft.tokenId === "string" &&
            tokens.some((item) => item.id === draft.tokenId)
          ) {
            setTokenId(draft.tokenId);
          }
        }
      } catch {
        removeSafeSessionStorageItem(DRAFT_STORAGE_KEY);
      }
    }
    setDraftRestored(true);
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clientParam = params.get("client");
    const amountParam = params.get("amount");
    const descriptionParam = params.get("description");

    if (clientParam && StrKey.isValidEd25519PublicKey(clientParam)) {
      setClient(clientParam);
    }
    const decimals = getTokenConfig(config.tokenId).decimals;
    if (
      amountParam &&
      /^(?:\d+)(?:\.\d+)?$/.test(amountParam) &&
      Number.isFinite(Number(amountParam)) &&
      Number(amountParam) > 0 &&
      (amountParam.split(".")[1]?.length ?? 0) <= decimals
    ) {
      setAmount(amountParam);
    }
    if (descriptionParam?.trim() && descriptionParam.length <= 120) {
      setDescription(descriptionParam);
    }
  }, []);
  useEffect(() => {
    if (!draftRestored) return;
    const draft = { client, amount, description, dueDate, tokenId };
    if (client || amount || description || dueDate) {
      setSafeSessionStorageItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } else {
      removeSafeSessionStorageItem(DRAFT_STORAGE_KEY);
    }
  }, [draftRestored, client, amount, description, dueDate, tokenId]);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [customTemplates, setCustomTemplates] = useState<InvoiceTemplate[]>(
    () => loadCustomTemplates(),
  );
  const [templateName, setTemplateName] = useState("");
  const [savedClients, setSavedClients] = useState<SavedClient[]>([]);
  const [saveClientAfterCreate, setSaveClientAfterCreate] = useState(false);
  const [clientNickname, setClientNickname] = useState("");
  const [manageClients, setManageClients] = useState(false);
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [editingNickname, setEditingNickname] = useState("");
  const token = useTokenMeta(tokenId);

  const configured = isConfigured();

  useEffect(() => setSavedClients(loadSavedClients()), []);

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
    // Issue #66: an empty due date is fine; a date before today is not.
    const dueErr = dueDateError(dueDate);
    if (dueErr) return dueErr;
    if (saveClientAfterCreate && !clientNickname.trim()) {
      return "Enter a nickname for this saved client.";
    }
    return null;
  }

  function chooseClient(value: string) {
    const savedClient = savedClients.find(
      (saved) =>
        saved.nickname.toLocaleLowerCase() === value.trim().toLocaleLowerCase(),
    );
    setClient(savedClient?.address ?? value.trim());
    if (savedClient) setClientNickname(savedClient.nickname);
  }

  function renameClient(addressToRename: string) {
    setSavedClients(renameSavedClient(addressToRename, editingNickname));
    setEditingAddress(null);
    setEditingNickname("");
  }

  function applyTemplate(id: string) {
    const template = [...BUILTIN_TEMPLATES, ...customTemplates].find(
      (t) => t.id === id,
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
            dueDate: dueDateToUnix(dueDate),
            status: "Pending" as const,
            createdAt: 0n,
            paidAt: 0n,
          }
        : null,
    [client, amount, description, dueDate, address, tokenId, token.decimals],
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
      const dueUnix = dueDateToUnix(dueDate);
      const res = await createInvoice({
        freelancer: address,
        client,
        amount: toBaseUnits(amount, token.decimals),
        description: description.trim(),
        dueDate: dueUnix,
        token: tokenId,
      });
      setResult(res);
      trackEvent("invoice_created");
      if (saveClientAfterCreate) {
        setSavedClients(
          saveClient({ nickname: clientNickname, address: client }),
        );
      }
      setClient("");
      setAmount("");
      setDescription("");
      setDueDate("");
      setSaveClientAfterCreate(false);
      setClientNickname("");
      removeSafeSessionStorageItem(DRAFT_STORAGE_KEY);
    } catch (e) {
      setError(errorMessage(e, "Failed to create invoice."));
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
        <ConnectPrompt message="Connect your wallet to create an invoice." />
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
                onChange={(e) =>
                  e.target.value && applyTemplate(e.target.value)
                }
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
                  onKeyDown={(e) => {
                    // Enter here saves the template; it must not submit the
                    // invoice form (which would open a signing request).
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveTemplate();
                    }
                  }}
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
                  <span
                    key={t.id}
                    className="badge bg-brand-500/15 text-brand-200"
                  >
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
              Templates prefill the description and amount. Your saved templates
              stay in this browser.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label className="label" htmlFor="client">
                Client wallet address
              </label>
              {savedClients.length > 0 && (
                <button
                  type="button"
                  className="text-xs text-brand-200 underline"
                  aria-expanded={manageClients}
                  onClick={() => setManageClients((open) => !open)}
                >
                  {manageClients ? "Done" : "Manage clients"}
                </button>
              )}
            </div>
            <input
              id="client"
              className="input font-mono text-xs"
              placeholder="GABC…"
              value={client}
              onChange={(e) => chooseClient(e.target.value)}
              autoComplete="off"
              list="saved-clients"
            />
            <datalist id="saved-clients">
              {savedClients.map((saved) => (
                <option
                  key={saved.address}
                  value={saved.nickname}
                  label={saved.address}
                />
              ))}
            </datalist>
            {manageClients && (
              <ul className="mt-2 space-y-2">
                {savedClients.map((saved) => (
                  <li
                    key={saved.address}
                    className="flex flex-wrap items-center gap-2 text-xs"
                  >
                    {editingAddress === saved.address ? (
                      <>
                        <input
                          className="input min-w-0 flex-1"
                          aria-label={`Rename ${saved.nickname}`}
                          value={editingNickname}
                          maxLength={40}
                          onChange={(e) => setEditingNickname(e.target.value)}
                        />
                        <button
                          type="button"
                          className="text-brand-200 underline"
                          onClick={() => renameClient(saved.address)}
                          disabled={!editingNickname.trim()}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="text-slate-400 underline"
                          onClick={() => setEditingAddress(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="font-medium">{saved.nickname}</span>
                        <span className="min-w-0 flex-1 truncate font-mono text-slate-500">
                          {saved.address}
                        </span>
                        <button
                          type="button"
                          className="text-brand-200 underline"
                          onClick={() => {
                            setEditingAddress(saved.address);
                            setEditingNickname(saved.nickname);
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="text-red-300 underline"
                          onClick={() =>
                            setSavedClients(deleteSavedClient(saved.address))
                          }
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 space-y-2">
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={saveClientAfterCreate}
                  onChange={(e) => setSaveClientAfterCreate(e.target.checked)}
                />
                Save this client after creating the invoice
              </label>
              {saveClientAfterCreate && (
                <input
                  className="input"
                  placeholder="Client nickname"
                  value={clientNickname}
                  onChange={(e) => setClientNickname(e.target.value)}
                  maxLength={40}
                  aria-label="Saved client nickname"
                />
              )}
            </div>
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
                Only tokens allowed by the contract can be selected. This choice
                is fixed once the invoice is created.
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
              <p
                id="due-error"
                role="alert"
                className="mt-1 text-xs text-red-300"
              >
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
              disabled={submitting || wrongNetwork}
              title={wrongNetwork ? "Switch Freighter to Testnet first" : undefined}
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
            You&apos;ll approve one transaction in your wallet to record the
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
