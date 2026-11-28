"use client";

import Link from "next/link";
import { useWallet } from "@/components/WalletProvider";
import { ConnectPrompt } from "@/components/ConnectPrompt";
import { DashboardInvoiceList } from "@/components/DashboardInvoiceList";
import { IncomeOverview } from "@/components/IncomeOverview";
import { ShareMenu } from "@/components/ShareMenu";
import { Alert, EmptyState, Spinner } from "@/components/ui";
import {
  getAllInvoices,
  getInvoiceHistory,
  getTokenBalance,
  type Invoice,
} from "@/lib/contract";
import {
  deriveClientInvoices,
  type ClientInvoiceSummary,
} from "@/lib/client-invoices";
import { formatAmount } from "@/lib/format";
import { config, isConfigured, tokens } from "@/lib/config";
import { FaucetButton } from "@/components/FaucetButton";
import { TrustlineButton } from "@/components/TrustlineButton";
import { TokenAmount } from "@/components/TokenAmount";
import { isOverdue } from "@/lib/invoice-helpers";
import { useAsyncResource } from "@/lib/use-async-resource";

const NO_INVOICES: Invoice[] = [];
const NO_BALANCES: Record<string, bigint> = {};
const NO_CLIENT_SUMMARY: ClientInvoiceSummary = {
  invoices: [],
  count: 0,
  totalOwed: 0n,
  overdueCount: 0,
};

export default function DashboardPage() {
  const { address } = useWallet();
  const {
    data,
    loading,
    error,
    reload: load,
  } = useAsyncResource(
    async () => {
      const [hist, bals, scan] = await Promise.all([
        getInvoiceHistory(address as string),
        Promise.all(
          tokens.map((t) =>
            getTokenBalance(address as string, t.id).catch(() => null),
          ),
        ),
        getAllInvoices(),
      ]);
      const next: Record<string, bigint> = {};
      tokens.forEach((t, i) => {
        const value = bals[i];
        if (value !== null) next[t.id] = value;
      });
      return {
        // Newest first.
        invoices: [...hist].reverse(),
        balances: next,
        clientSummary: deriveClientInvoices(scan.invoices, address as string),
      };
    },
    [address],
    { enabled: Boolean(address), fallbackError: "Failed to load your invoices." },
  );
  const invoices = data?.invoices ?? NO_INVOICES;
  const balances = data?.balances ?? NO_BALANCES;
  const clientSummary = data?.clientSummary ?? NO_CLIENT_SUMMARY;

  if (!isConfigured()) {
    return (
      <Alert kind="info">
        The contract isn&apos;t configured yet. Set the{" "}
        <code>NEXT_PUBLIC_*</code> contract variables to use the dashboard.
      </Alert>
    );
  }

  if (!address) {
    return (
      <ConnectPrompt
        title="Your dashboard"
        message="Connect your wallet to see your invoices and balance."
        className="py-14"
        messageClassName="text-slate-400"
      />
    );
  }

  const paidTotals = totalsByToken(invoices, "Paid");
  const pendingTotals = totalsByToken(invoices, "Pending");
  const pending = invoices.filter((i) => i.status === "Pending");
  const overdue = pending.filter((i) => isOverdue(i));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <FaucetButton onDone={load} />
          <Link href="/create" className="btn-primary text-sm">
            New invoice
          </Link>
        </div>
      </div>

      <div className={`grid gap-4 ${clientSummary.count > 0 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        <div className="card">
          <p className="text-sm text-slate-400">Wallet balance</p>
          {tokens.map((t) => (
            <p key={t.id} className="mt-1 text-2xl font-bold">
              {balances[t.id] === undefined ? (
                "—"
              ) : (
                <TokenAmount
                  amount={balances[t.id] ?? 0n}
                  tokenId={t.id}
                  symbolClassName="text-base text-slate-400"
                />
              )}
            </p>
          ))}
        </div>
        <div className="card">
          <p className="text-sm text-slate-400">Received (paid)</p>
          <TokenTotals totals={paidTotals} tone="text-emerald-300" />
        </div>
        <div className="card">
          <p className="text-sm text-slate-400">Awaiting payment</p>
          <TokenTotals totals={pendingTotals} tone="text-amber-300" />
        </div>
        {clientSummary.count > 0 && (
          <div className="card">
            <p className="text-sm text-slate-400">Invoices to pay</p>
            <p className="mt-1 text-2xl font-bold text-rose-300">
              {formatAmount(clientSummary.totalOwed)}{" "}
              <span className="text-base text-slate-400">{config.tokenSymbol}</span>
            </p>
            <p className="text-xs text-slate-400">
              {clientSummary.count} pending
              {clientSummary.overdueCount > 0 && (
                <span className="text-red-300"> · {clientSummary.overdueCount} overdue</span>
              )}
            </p>
          </div>
        )}
      </div>

      <IncomeOverview invoices={invoices} />

      {error && (
        <Alert kind="error">
          <span>{error}</span>{" "}
          <button onClick={load} className="ml-2 underline">
            Retry
          </button>
        </Alert>
      )}

      {tokens.map((t) => (
        <TrustlineButton key={t.id} tokenId={t.id} onDone={load} />
      ))}

      {pending.length > 0 && (
        <RemindersCard pending={pending} overdueCount={overdue.length} />
      )}

      {clientSummary.count > 0 && (
        <section className="space-y-3" aria-labelledby="to-pay-heading">
          <div>
            <h2 id="to-pay-heading" className="text-lg font-semibold">
              Invoices to pay
            </h2>
            <p className="text-sm text-slate-400">
              {clientSummary.count} pending · {formatAmount(clientSummary.totalOwed)}{" "}
              {config.tokenSymbol} owed
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {clientSummary.invoices.map((inv) => (
              <InvoiceCard key={inv.id} invoice={inv} role="client" />
            ))}
          </div>
        </section>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your invoices</h2>
        <button onClick={load} disabled={loading} className="btn-ghost text-xs">
          {loading ? <Spinner /> : "Refresh"}
        </button>
      </div>

      {loading && invoices.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="card h-40 animate-pulse bg-white/5" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          subtitle="Three quick steps to your first payment: enable USDC, create an invoice, share the link."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/create" className="btn-primary text-sm">
                Create invoice
              </Link>
              <Link href="/history" className="btn-ghost text-sm">
                History
              </Link>
            </div>
          }
        />
      ) : (
        <DashboardInvoiceList invoices={invoices} />
      )}
    </div>
  );
}

// Totals are kept per token so invoices in different tokens never get mixed.
function totalsByToken(invoices: Invoice[], status: Invoice["status"]) {
  const totals = new Map<string, bigint>();
  for (const inv of invoices) {
    if (inv.status !== status) continue;
    totals.set(inv.token, (totals.get(inv.token) ?? 0n) + inv.amount);
  }
  return totals;
}

function TokenTotals({
  totals,
  tone,
}: {
  totals: Map<string, bigint>;
  tone: string;
}) {
  if (totals.size === 0) {
    return <p className={`mt-1 text-2xl font-bold ${tone}`}>0</p>;
  }
  return (
    <>
      {[...totals].map(([tokenId, amount]) => (
        <p key={tokenId} className={`mt-1 text-2xl font-bold ${tone}`}>
          <TokenAmount amount={amount} tokenId={tokenId} />
        </p>
      ))}
    </>
  );
}

// Quick-action card for unpaid invoices: share/copy reminder messages from one menu.
function RemindersCard({
  pending,
  overdueCount,
}: {
  pending: Invoice[];
  overdueCount: number;
}) {
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">Payment reminders</p>
          <p className="text-xs text-slate-400">
            {pending.length} pending ·{" "}
            {overdueCount > 0 ? (
              <span className="text-red-300">{overdueCount} overdue</span>
            ) : (
              "none overdue"
            )}
          </p>
        </div>
        <span className="text-xl">🔔</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {pending.map((inv) => (
          <ShareMenu
            key={inv.id}
            invoice={inv}
            align="left"
            buttonClassName="btn-ghost text-xs"
            label={`Remind #${inv.id}`}
          />
        ))}
      </div>
    </div>
  );
}


