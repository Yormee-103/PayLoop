"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// First-run guided tour + replayable walkthrough (navbar "?"). Opens
// automatically once per browser, and can be reopened anytime via the
// "payloop:open-tour" custom event. Lightweight by design — no tour library.
//
// This directly addresses Level-5 feedback asking for an onboarding tutorial /
// product walkthrough and a help section (users 2, 6, 8).

const steps = [
  {
    title: "Connect your wallet",
    body: "Install the Freighter browser extension, switch it to Testnet, then connect from the button in the top-right. Your wallet is your PayLoop account.",
    href: null,
    cta: null,
  },
  {
    title: "Enable USDC & grab test funds",
    body: "Open the Dashboard and tap “Enable USDC” once — this lets your wallet hold the token. Then “Get test USDC” to mint 500 test tokens for free.",
    href: "/dashboard",
    cta: "Open dashboard",
  },
  {
    title: "Create an invoice & share the link",
    body: "New invoice → enter your client's wallet, amount and description → preview it, then create. Copy the payment link and send it to your client.",
    href: "/create",
    cta: "Create an invoice",
  },
  {
    title: "Your client pays in one click",
    body: "The client opens the link, connects their wallet, and pays. USDC lands with you in seconds — recorded on-chain forever.",
    href: "/history",
    cta: "See your history",
  },
];

const STORAGE_KEY = "payloop.tour.done";

export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const firstVisit =
      typeof window === "undefined" || !localStorage.getItem(STORAGE_KEY);
    if (firstVisit) setOpen(true);
    const onOpen = () => setOpen(true);
    window.addEventListener("payloop:open-tour", onOpen);
    return () => window.removeEventListener("payloop:open-tour", onOpen);
  }, []);

  function close() {
    setOpen(false);
    setStep(0);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Non-fatal if storage is blocked.
    }
  }

  if (!open) return null;

  const s = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to PayLoop"
      onClick={close}
    >
      <div
        className="card w-full max-w-md space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="badge bg-brand-500/15 text-brand-200">
            Step {step + 1} of {steps.length}
          </span>
          <button
            onClick={close}
            className="text-slate-400 hover:text-white"
            aria-label="Close tour"
          >
            ✕
          </button>
        </div>

        <div>
          <h2 className="text-xl font-bold">{s.title}</h2>
          <p className="mt-2 text-sm text-slate-400">{s.body}</p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={close}
            className="btn-ghost text-sm"
            disabled={step === 0}
          >
            Skip
          </button>
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${
                  i === step ? "bg-brand-400" : "bg-white/20"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStep((n) => Math.max(0, n - 1))}
              className="btn-ghost text-sm"
              disabled={step === 0}
            >
              Back
            </button>
            {isLast ? (
              <button onClick={close} className="btn-primary text-sm">
                Get started
              </button>
            ) : (
              <button
                onClick={() => setStep((n) => Math.min(steps.length - 1, n + 1))}
                className="btn-primary text-sm"
              >
                Next
              </button>
            )}
          </div>
        </div>

        {s.href && s.cta && (
          <Link href={s.href} onClick={close} className="btn-ghost w-full text-sm">
            {s.cta} →
          </Link>
        )}
      </div>
    </div>
  );
}
