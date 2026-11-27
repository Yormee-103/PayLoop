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
import { config, explorer } from "@/lib/config";
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
  return (
    <html lang="en" className="dark">
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
                <p>PayLoop · Built on Stellar Soroban · Testnet demo</p>
                <nav
                  aria-label="Footer links"
                  className="flex flex-wrap items-center justify-center gap-4 text-slate-400"
                >
                  <Link href="/activity" className="transition hover:text-white">
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
