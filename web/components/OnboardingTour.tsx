"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "./Modal";

// First-run guided tour + replayable walkthrough (navbar "?"). Opens
// automatically once per browser, and can be reopened anytime via the
// "payloop:open-tour" custom event. Lightweight by design — no tour library.
//
// This directly addresses Level-5 feedback asking for an onboarding tutorial /
// product walkthrough and a help section (users 2, 6, 8).

const steps = [
  { key: "connect", href: null, hasCta: false },
  { key: "usdc", href: "/dashboard", hasCta: true },
  { key: "invoice", href: "/create", hasCta: true },
  { key: "pay", href: "/history", hasCta: true },
] as const;

const STORAGE_KEY = "payloop.tour.done";

// Minimal English copy so this component has no dependency on the locale
// modules (the LocaleProvider path does not exist in this tree).
const en: Record<string, string> = {
  "tour.dialogLabel": "Product walkthrough",
  "tour.close": "Close walkthrough",
  "tour.stepOf": "Step {step} of {total}",
  "tour.skip": "Skip",
  "tour.back": "Back",
  "tour.next": "Next",
  "tour.getStarted": "Get started",
  "tour.steps.connect.title": "Connect your wallet",
  "tour.steps.connect.body": "Install Freighter, switch it to Testnet, then connect from the top-right corner.",
  "tour.steps.usdc.title": "Enable USDC and get test funds",
  "tour.steps.usdc.body": "Enable USDC once on the Dashboard, then mint free test USDC from the faucet.",
  "tour.steps.usdc.cta": "Go to Dashboard",
  "tour.steps.invoice.title": "Create an invoice",
  "tour.steps.invoice.body": "Describe the work, enter your client's wallet address and an amount in USDC.",
  "tour.steps.invoice.cta": "Create an invoice",
  "tour.steps.pay.title": "Get paid",
  "tour.steps.pay.body": "Share the payment link. Your client pays in one click and the invoice flips to Paid.",
  "tour.steps.pay.cta": "View history",
};

function t(key: string, vars?: Record<string, string | number>): string {
  // Missing keys fall back to the English copy, then to the raw key.
  let out = en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replace(`{${k}}`, String(v));
    }
  }
  return out;
}

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

  const s = steps[step];
  const isLast = step === steps.length - 1;
  const title = t(`tour.steps.${s.key}.title`);
  const body = t(`tour.steps.${s.key}.body`);
  const cta = s.hasCta ? t(`tour.steps.${s.key}.cta`) : null;

  return (
    <Modal
      open={open}
      onClose={close}
      label={t("tour.dialogLabel")}
      panelClassName="card w-full max-w-md space-y-4"
    >
      <div className="flex items-center justify-between">
          <span className="badge bg-brand-500/15 text-brand-200">
            {t("tour.stepOf", { step: step + 1, total: steps.length })}
          </span>
          <button
            onClick={close}
            className="text-slate-400 hover:text-white"
            aria-label={t("tour.close")}
          >
            ✕
          </button>
        </div>

        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="mt-2 text-sm text-slate-400">{body}</p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={close}
            className="btn-ghost text-sm"
            disabled={step === 0}
          >
            {t("tour.skip")}
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
              {t("tour.back")}
            </button>
            {isLast ? (
              <button onClick={close} className="btn-primary text-sm">
                {t("tour.getStarted")}
              </button>
            ) : (
              <button
                onClick={() => setStep((n) => Math.min(steps.length - 1, n + 1))}
                className="btn-primary text-sm"
              >
                {t("tour.next")}
              </button>
            )}
          </div>
        </div>

        {s.href && cta && (
          <Link href={s.href} onClick={close} className="btn-ghost w-full text-sm">
            {cta} →
          </Link>
        )}
    </Modal>
  );
}