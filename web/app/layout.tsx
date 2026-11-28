import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { WalletProvider } from "@/components/WalletProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Navbar } from "@/components/Navbar";
import { WrongNetworkBanner } from "@/components/WrongNetworkBanner";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { OnboardingTour } from "@/components/OnboardingTour";
import { siteUrl } from "@/lib/site";
import { config, configErrors, explorer } from "@/lib/config";
import Link from "next/link";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  // Routes set their own `title` (see each segment's layout.tsx); the template
  // appends the site name, and `default` is used where a route sets none.
  title: {
    default: "PayLoop — Get paid in crypto, cash out in Naira",
    template: "%s · PayLoop",
  },
  description:
    "PayLoop lets African freelancers invoice foreign clients in USDC on Stellar and cash out to local currency. Fast, low-fee, on-chain proof of payment.",
  openGraph: {
    title: "PayLoop",
    description:
      "Invoice foreign clients in USDC on Stellar, cash out in Naira.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1220",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (configErrors.length > 0) {
    return (
      <html lang="en" className="dark">
        <body>
          <main className="mx-auto max-w-2xl px-6 py-16 text-slate-100">
            <h1 className="text-2xl font-semibold text-red-400">
              Configuration Error
            </h1>
            <p className="mt-3 text-sm text-slate-300">
              PayLoop could not start because one or more{" "}
              <code>NEXT_PUBLIC_*</code> environment variables are invalid. Fix
              the following issues and redeploy:
            </p>
            <ul className="mt-6 list-disc space-y-2 rounded-lg border border-red-500/30 bg-red-950/30 p-5 pl-9 text-sm text-red-200">
              {configErrors.map((err) => (
                <li key={err} className="break-words font-mono text-xs">
                  {err}
                </li>
              ))}
            </ul>
          </main>
        </body>
      </html>
    );
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem("theme");var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){document.documentElement.classList.add("dark");}})();`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <WalletProvider>
            {/* Issue #72: first Tab stop; visible only while focused. */}
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:outline-none focus:ring-2 focus:ring-white"
            >
              Skip to content
            </a>
            <Navbar />
            <WrongNetworkBanner />
            <main
              id="main"
              tabIndex={-1}
              className="mx-auto max-w-5xl px-4 py-8 focus:outline-none"
            >
              {children}
            </main>
            <footer className="border-t border-white/5 py-10 text-xs text-slate-500">
              <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 sm:flex-row">
                <p>
                  PayLoop · Built on Stellar Soroban
                  {config.network !== "PUBLIC" && " · Testnet demo"}
                </p>
                <nav
                  aria-label="Footer links"
                  className="flex flex-wrap items-center justify-center gap-4 text-slate-400"
                >
                  <Link
                    href="/activity"
                    className="transition hover:text-white"
                  >
                    Activity
                  </Link>
                  <Link href="/help" className="transition hover:text-white">
                    Help
                  </Link>
                  <a
                    href="https://github.com/Yormee-103/PayLoop"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition hover:text-white"
                  >
                    GitHub
                  </a>
                  <a
                    href={explorer.contract(config.contractId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition hover:text-white"
                  >
                    Contract
                  </a>
                  <a
                    href="https://github.com/Yormee-103/PayLoop/blob/main/SECURITY.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition hover:text-white"
                  >
                    Security
                  </a>
                </nav>
              </div>
            </footer>
            <FeedbackWidget />
            <OnboardingTour />
          </WalletProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
