"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/components/WalletProvider";
import { ConnectPrompt } from "@/components/ConnectPrompt";
import { ScanStatus } from "@/components/ScanStatus";
import { TokenAmount } from "@/components/TokenAmount";
import { Alert, EmptyState, Spinner } from "@/components/ui";
import { config, explorer, isConfigured } from "@/lib/config";
import { formatDate, humanizeDescription, shortAddress } from "@/lib/format";
import { todayDateInputValue } from "@/lib/invoice-helpers";
import { buildStatement, parseRange, statementTitle } from "@/lib/statement";
import { useInvoiceScan } from "@/lib/use-invoice-scan";

// Printable proof of income: every invoice the connected wallet was paid for in
// a date range, with totals and links to check each one on-chain. Built in the
// browser from the same invoice scan as the History page; print or save as PDF.
export default function StatementPage() {
  const { address } = useWallet();
  const scan = useInvoiceScan();
  const today = todayDateInputValue();
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);

  const parsed = useMemo(() => parseRange(from, to), [from, to]);
  const statement = useMemo(() => {
    if (!address || !parsed.ok) return null;
    return buildStatement(scan.invoices, address, parsed.range);
  }, [scan.invoices, address, parsed]);

  const [generatedOn, setGeneratedOn] = useState("");
  useEffect(() => {
    setGeneratedOn(
      new Date().toLocaleDateString(undefined, { dateStyle: "long" }),
    );
  }, []);

  function print() {
    // The document title becomes the suggested file name in "Save as PDF".
    const previous = document.title;
    document.title = statementTitle(from, to);
    const restore = () => {
      document.title = previous;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  }

  if (!isConfigured()) {
    return <Alert kind="info">The contract isn&apos;t configured yet.</Alert>;
  }

  if (!address) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Income statement</h1>
          <p className="mt-1 text-sm text-slate-400">
            A printable record of the invoices you were paid for, to share with
            a bank, landlord or visa office.
          </p>
        </div>
        <ConnectPrompt message="Connect your wallet to build your income statement." />
      </div>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const canPrint = Boolean(statement && statement.rows.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Income statement</h1>
          <p className="mt-1 text-sm text-slate-400">
            Paid invoices where you were the freelancer, for the dates you
            choose.
          </p>
        </div>
        <Link href="/history" className="btn-ghost text-xs">
          Back to history
        </Link>
      </div>

      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="statement-from">
            From
          </label>
          <input
            id="statement-from"
            type="date"
            className="input"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="statement-to">
            To
          </label>
          <input
            id="statement-to"
            type="date"
            className="input"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <button
          onClick={scan.retry}
          disabled={scan.loading}
          className="btn-ghost text-xs"
        >
          {scan.loading ? <Spinner /> : "Refresh"}
        </button>
        <button
          onClick={print}
          disabled={!canPrint}
          className="btn-primary ml-auto text-sm"
        >
          Print / Save as PDF
        </button>
      </div>

      {!parsed.ok && <Alert kind="error">{parsed.error}</Alert>}

      <ScanStatus
        error={scan.error}
        reachedCap={scan.reachedCap}
        count={scan.invoices.length}
        scannedThrough={scan.scannedThrough}
        loading={scan.loading}
        onRetry={scan.retry}
      />

      {scan.loading && scan.invoices.length === 0 ? (
        <div className="card h-48 motion-reduce:animate-none animate-pulse bg-white/5" />
      ) : statement && statement.rows.length === 0 ? (
        <EmptyState
          title="No paid invoices in this range"
          subtitle="Pick a wider range, or wait until a client has paid an invoice."
        />
      ) : statement ? (
        <section
          className="print-area invoice-print card space-y-6"
          aria-label="Income statement"
        >
          <header className="space-y-1">
            <h2 className="text-xl font-bold">PayLoop income statement</h2>
            <p className="text-sm text-slate-400">
              {from} to {to} · Generated {generatedOn || "today"}
            </p>
            <p className="text-sm">
              Wallet:{" "}
              <span className="break-all font-mono text-xs">{address}</span>
            </p>
          </header>

          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Total received
            </h3>
            {statement.totals.map((t) => (
              <p key={t.token} className="text-2xl font-bold">
                <TokenAmount amount={t.amount} tokenId={t.token} />
              </p>
            ))}
            <p className="mt-1 text-xs text-slate-400">
              {statement.rows.length} paid invoice
              {statement.rows.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3 font-medium">Paid</th>
                  <th className="py-2 pr-3 font-medium">Invoice</th>
                  <th className="py-2 pr-3 font-medium">Description</th>
                  <th className="py-2 pr-3 font-medium">Client</th>
                  <th className="py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {statement.rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-white/5 align-top"
                  >
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {formatDate(row.paidAt)}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span className="font-mono">#{row.id}</span>
                      <br />
                      <span className="break-all text-xs text-slate-400">
                        {origin}/pay/{row.id}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      {humanizeDescription(row.description) || "—"}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {shortAddress(row.client)}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <TokenAmount
                        amount={row.amount}
                        tokenId={row.token}
                        className="font-semibold"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="space-y-1 border-t border-white/10 pt-4 text-xs text-slate-400">
            <p>
              Every row is a payment recorded on the Stellar{" "}
              {config.network.toLowerCase()} by the PayLoop contract. Open the
              invoice link above to see it, or check the contract and wallet on
              the explorer:
            </p>
            <p className="break-all">
              Contract: {explorer.contract(config.contractId)}
            </p>
            <p className="break-all">Wallet: {explorer.account(address)}</p>
            {statement.undated > 0 && (
              <p>
                {statement.undated} paid invoice
                {statement.undated === 1 ? " has" : "s have"} no recorded
                payment date and {statement.undated === 1 ? "is" : "are"} not
                included.
              </p>
            )}
            {config.network !== "PUBLIC" && (
              <p>
                This statement is from a test network. It does not show real
                money and is not proof of income.
              </p>
            )}
          </footer>
        </section>
      ) : null}
    </div>
  );
}
