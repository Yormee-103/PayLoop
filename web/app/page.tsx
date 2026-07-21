import Link from "next/link";

const steps = [
  {
    title: "Create an invoice",
    body: "Enter your client, amount in USDC, and what the work was. It's recorded on-chain.",
  },
  {
    title: "Client pays in one click",
    body: "Your client connects their wallet and funds the invoice. USDC lands with you instantly.",
  },
  {
    title: "Cash out in Naira",
    body: "Withdraw your USDC to local currency through a partner anchor.",
  },
];

export default function Home() {
  return (
    <div className="space-y-16">
      <section className="grid items-center gap-8 pt-8 sm:grid-cols-2">
        <div className="space-y-6">
          <span className="badge bg-brand-500/15 text-brand-200">
            Built on Stellar
          </span>
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
            Get paid by clients abroad.{" "}
            <span className="text-brand-400">Cash out at home.</span>
          </h1>
          <p className="max-w-md text-base text-slate-400 sm:text-lg">
            PayLoop lets African freelancers invoice foreign clients in USDC on
            Stellar — settled in seconds, for fractions of a cent — then cash out
            to Naira.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/create" className="btn-primary">
              Create an invoice
            </Link>
            <Link href="/dashboard" className="btn-ghost">
              View dashboard
            </Link>
          </div>
        </div>
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Invoice #1042</span>
            <span className="badge bg-emerald-500/15 text-emerald-300">
              Paid
            </span>
          </div>
          <div className="text-3xl font-bold">1,500.00 USDC</div>
          <div className="text-sm text-slate-400">
            Brand website redesign · paid by a client in Berlin
          </div>
          <div className="rounded-lg bg-ink-900/60 p-3 text-sm text-slate-300">
            ≈ ₦2,340,000 available to withdraw
          </div>
        </div>
      </section>

      <section className="space-y-8">
        <h2 className="text-center text-2xl font-bold">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="card space-y-2">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-500 font-bold text-white">
                {i + 1}
              </div>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="text-sm text-slate-400">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card flex flex-col items-center gap-4 py-10 text-center">
        <h2 className="text-2xl font-bold">Ready to try it?</h2>
        <p className="max-w-md text-slate-400">
          Connect a Freighter wallet on Stellar testnet, grab some test USDC, and
          run the full invoice-to-payout loop.
        </p>
        <Link href="/create" className="btn-primary">
          Get started
        </Link>
      </section>
    </div>
  );
}
