"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "./WalletProvider";
import { useTheme } from "./ThemeProvider";
import { shortAddress } from "@/lib/format";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/create", label: "New invoice" },
  { href: "/history", label: "History" },
  { href: "/withdraw", label: "Withdraw" },
  { href: "/activity", label: "Activity" },
  { href: "/help", label: "Help" },
];

export function Navbar() {
  const { address, connect, connecting, disconnect } = useWallet();
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function openTour() {
    window.dispatchEvent(new CustomEvent("payloop:open-tour"));
    setOpen(false);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-ink-900/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold"
          onClick={() => setOpen(false)}
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500 text-white">
            ₽
          </span>
          <span className="text-lg tracking-tight">PayLoop</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                pathname === l.href
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={openTour}
            title="How it works"
            aria-label="Open walkthrough"
            className="btn-ghost hidden h-9 w-9 px-0 text-sm font-bold sm:grid place-items-center"
          >
            ?
          </button>
          <button
            onClick={toggle}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle theme"
            className="btn-ghost h-9 w-9 px-0 text-base"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          {address ? (
            <button
              onClick={disconnect}
              title="Click to disconnect"
              className="btn-ghost font-mono text-xs"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {shortAddress(address)}
            </button>
          ) : (
            <button
              onClick={connect}
              disabled={connecting}
              className="btn-primary text-sm"
            >
              {connecting ? "Connecting…" : "Connect wallet"}
            </button>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setOpen((o) => !o)}
            className="btn-ghost px-2.5 lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
          >
            <span className="text-lg leading-none">{open ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {open && (
        <nav
          id="mobile-nav"
          className="border-t border-white/10 bg-ink-900/95 px-4 py-2 lg:hidden"
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                pathname === l.href
                  ? "bg-white/10 text-white"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <button
            onClick={openTour}
            className="mt-1 block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
          >
            ? How it works
          </button>
        </nav>
      )}
    </header>
  );
}
