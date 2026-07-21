import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { WalletProvider } from "@/components/WalletProvider";
import { Navbar } from "@/components/Navbar";
import { FeedbackWidget } from "@/components/FeedbackWidget";

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
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <Navbar />
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
          <footer className="mx-auto max-w-5xl px-4 py-10 text-center text-xs text-slate-500">
            PayLoop · Built on Stellar Soroban · Testnet demo
          </footer>
          <FeedbackWidget />
        </WalletProvider>
        <Analytics />
      </body>
    </html>
  );
}
