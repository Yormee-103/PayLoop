import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { WalletProvider } from "@/components/WalletProvider";
import { ThemeProvider, STORAGE_KEY } from "@/components/ThemeProvider";
import { Navbar } from "@/components/Navbar";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { OnboardingTour } from "@/components/OnboardingTour";

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

// Inline script executed in <head> before paint to prevent theme flashing on initial visit.
const themeInitScript = `(function(){try{var s=localStorage.getItem('${STORAGE_KEY}');var t=s==='light'||s==='dark'?s:(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');var d=document.documentElement;if(t==='light'){d.classList.add('light');d.classList.remove('dark');d.style.colorScheme='light';}else{d.classList.add('dark');d.classList.remove('light');d.style.colorScheme='dark';}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <WalletProvider>
            <Navbar />
            <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
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
