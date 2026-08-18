import Link from "next/link";
import type { Metadata } from "next";

// In-app Help/FAQ. Static server component (no wallet needed) with native
// <details> accordions. Complements the first-run tour; answers the recurring
// questions from the Level-5 survey ("a more detailed help section").

export const metadata: Metadata = {
  title: "Help — PayLoop",
  description:
    "PayLoop help and FAQ: wallet setup, Enable USDC, test funds, creating and paying invoices, history, activity, and withdrawing to Naira.",
};

type Faq = { q: string; a: React.ReactNode };

function Section({ title, items }: { title: string; items: Faq[] }) {
  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="divide-y divide-white/5">
        {items.map((f) => (
          <details key={f.q} className="group py-1">
            <summary className="flex cursor-pointer items-center justify-between gap-2 py-2.5 text-sm font-medium text-slate-200 hover:text-white">
              {f.q}
              <span className="text-slate-500 transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="pb-3 text-sm leading-relaxed text-slate-400">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Help & FAQ</h1>
        <p className="mt-1 text-sm text-slate-400">
          Everything you need to get paid in USDC and cash out in Naira.
          Stuck? Start with the{" "}
          <Link href="/" className="text-brand-300 hover:underline">
            walkthrough
          </Link>
          .
        </p>
      </div>

      <Section
        title="Getting started"
        items={[
          {
            q: "What do I need to use PayLoop?",
            a: (
              <>
                A browser with the{" "}
                <a
                  href="https://freighter.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-300 hover:underline"
                >
                  Freighter
                </a>{" "}
                Stellar wallet extension installed, switched to Testnet
                (Settings → Network → Test Net). Your wallet address is your
                PayLoop account — there&apos;s no separate sign-up.
              </>
            ),
          },
          {
            q: "How do I connect my wallet?",
            a: "Click “Connect wallet” in the top-right of any page and approve in Freighter. The app remembers your connection until you disconnect.",
          },
          {
            q: "Is this real money?",
            a: "No — PayLoop runs on the Stellar Testnet for the demo. Tokens are free test USDC and test XLM, and transactions are publicly visible on the testnet explorer. The product is real; the funds are testnet.",
          },
        ]}
      />

      <Section
        title="USDC, test funds & balances"
        items={[
          {
            q: "What is “Enable USDC” and why is it required?",
            a: "Enable USDC establishes a trustline so your wallet is allowed to hold USDC. Every wallet must do it once before it can receive a payment (as a freelancer) or pay an invoice (as a client). Without it, payments fail with a trustline error. Open the Dashboard → Enable USDC → approve in Freighter.",
          },
          {
            q: "How do I get test USDC?",
            a: "On the Dashboard, click “Get test USDC”. The built-in faucet mints 500 test USDC straight to your connected wallet. You can also grab test XLM from the Stellar Friendbot to cover transaction fees.",
          },
          {
            q: "What is the ₦/USDC rate on Withdraw?",
            a: "The Withdraw page shows an indicative exchange rate and simulates the Naira payout. The on-chain USDC balance is real; the fiat leg is a mock for the demo (a live SEP-24 anchor integration is the planned production path).",
          },
        ]}
      />

      <Section
        title="Creating & sending invoices"
        items={[
          {
            q: "How do I create an invoice?",
            a: "New invoice → choose a template or type your own description → enter your client's wallet address and the amount (in USDC) → set an optional due date → preview it → Create invoice → approve one transaction in Freighter. The invoice is recorded on-chain.",
          },
          {
            q: "What are invoice templates?",
            a: "Templates prefill the description and amount for common freelance services (Website design, Mobile app, Logo design, and more). You can also save any current form as your own template — it stays in your browser for next time.",
          },
          {
            q: "What should I put in the client wallet address?",
            a: "Your client's Stellar address — a G… string 56 characters long. It can't be your own address. Send them the payment link and they pay in one click.",
          },
          {
            q: "Can I preview before sending?",
            a: "Yes. Click “👀 Preview invoice” to see the exact invoice sheet your client will see, including a Save-as-PDF option, before any transaction is signed.",
          },
          {
            q: "How do I charge again for a similar job?",
            a: "Use the template picker on the New invoice form, or save your current form as a custom template with the “Save current as template” button.",
          },
        ]}
      />

      <Section
        title="Getting paid"
        items={[
          {
            q: "How does my client pay?",
            a: "Send them the /pay/{id} link. They open it, connect their wallet (Enable USDC first if prompted), and click Pay. USDC settles to your wallet in seconds and the invoice flips to Paid on-chain.",
          },
          {
            q: "How do I remind a client to pay?",
            a: "Open History, find the pending invoice, and click “Remind” — it copies a ready-to-send reminder to your clipboard. The Dashboard also lists overdue invoices.",
          },
          {
            q: "Where can I see my payments?",
            a: "History shows invoices where you're the freelancer or client, with search and status/role filters. Activity shows the full on-chain feed with usage stats and CSV export.",
          },
        ]}
      />

      <Section
        title="Troubleshooting"
        items={[
          {
            q: "Payment fails with a trustline error",
            a: "The client's wallet hasn't Enabled USDC. Have them open the Dashboard → Enable USDC → approve, then retry the payment.",
          },
          {
            q: "Freighter says I'm on the wrong network",
            a: "Switch Freighter to Testnet (Settings → Network → Test Net). PayLoop currently runs on the Stellar Testnet only.",
          },
          {
            q: "My balance looks wrong",
            a: "Make sure the wallet you connected is the one where you minted or received USDC. Enable USDC may be required on a newly funded account before balances appear.",
          },
          {
            q: "I entered the wrong client address",
            a: "Invoices are stored on-chain and can't be edited after creation. Create a new invoice with the correct address and ask your client to use that payment link instead.",
          },
        ]}
      />
    </div>
  );
}
