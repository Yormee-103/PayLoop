import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { WalletProvider } from "@/components/WalletProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Navbar } from "@/components/Navbar";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { OnboardingTour } from "@/components/OnboardingTour";
import { MisconfigurationScreen } from "@/components/MisconfigurationScreen";
import { validateConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "PayLoop — Get paid in crypto, cash out in Naira",
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
  const configErrors = validateConfig();
  const isMisconfigured = configErrors.length > 0;

  return (
    <html lang="en" className="dark">
      <body>
        <ThemeProvider>
          <WalletProvider>
            <Navbar />
            <main className="mx-auto max-w-5xl px-4 py-8">
              {isMisconfigured ? (
                <MisconfigurationScreen errors={configErrors} />
              ) : (
                children
              )}
            </main>
            <footer className="mx-auto max-w-5xl px-4 py-10 text-center text-xs text-slate-500">
              PayLoop · Built on Stellar Soroban · Testnet demo
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
