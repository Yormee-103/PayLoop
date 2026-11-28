"use client";

import { useState } from "react";
import { useWallet } from "./WalletProvider";
import { Spinner } from "./ui";
import { errorMessage } from "@/lib/async-resource";
import { Modal } from "./Modal";

// Message catalogue. Keys are read via t(); missing keys fall back to English.
// Locale files live in web/messages/<locale>.json once next-intl is wired up.
export const feedbackMessages = {
  en: {
    pickRatingOrNote: "Pick a rating or write a note.",
    couldNotSend: "Could not send feedback.",
    feedbackButton: "💬 Feedback",
    sendFeedbackLabel: "Send feedback",
    shareFeedbackTitle: "Share feedback",
    thanks: "Thanks — that helps a lot.",
    close: "Close",
  },
} as const;

export type FeedbackMessageKey = keyof (typeof feedbackMessages)["en"];

export function t(key: FeedbackMessageKey, locale: "en" = "en"): string {
  return feedbackMessages[locale][key] ?? feedbackMessages.en[key];
}

// Floating feedback button + panel, mounted app-wide. Posts to /api/feedback.
// Required for the "basic user feedback collection" submission item; kept
// intentionally lightweight so onboarded users can leave a rating in seconds.
export function FeedbackWidget() {
  const { address } = useWallet();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [role, setRole] = useState("");
  // Honeypot: real users never see or fill this field. Bots often do.
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!rating && !message.trim()) {
      setErr(t("pickRatingOrNote"));
      return;
    }
    setState("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          message: message.trim(),
          role,
          address,
          website,
        }),
      });
      if (res.status === 429) {
        const retry = res.headers.get("Retry-After");
        const wait = retry ? ` Try again in about ${retry} seconds.` : "";
        throw new Error(
          `You've sent a lot of feedback recently. Thanks for the enthusiasm!${wait}`,
        );
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? t("couldNotSend"));
      }
      setState("done");
    } catch (e) {
      setErr(errorMessage(e, t("couldNotSend")));
      setState("error");
    }
  }

  function reset() {
    setOpen(false);
    setTimeout(() => {
      setRating(0);
      setMessage("");
      setRole("");
      setWebsite("");
      setState("idle");
      setErr(null);
    }, 200);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 rounded-full bg-brand-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/30 transition hover:bg-brand-400"
        aria-haspopup="dialog"
      >
        {t("feedbackButton")}
      </button>

      <Modal
        open={open}
        onClose={reset}
        label={t("sendFeedbackLabel")}
        backdropClassName="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
        panelClassName="card w-full max-w-md space-y-4"
      >
        <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{t("shareFeedbackTitle")}</h2>
              <button
                onClick={reset}
                className="text-slate-400 hover:text-white"
                aria-label={t("close")}
              >
                ✕
              </button>
            </div>

            {state === "done" ? (
              <div className="space-y-4 py-4 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-500/15 text-2xl">
                  ✓
                </div>
                <p className="font-semibold">{t("thanks")}</p>
                <button onClick={reset} className="btn-ghost w-full">
                  {t("close")}
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="label">How was your experience?</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRating(n)}
                        className={`text-2xl transition ${
                          n <= rating
                            ? "opacity-100"
                            : "opacity-30 hover:opacity-60"
                        }`}
                        aria-label={`${n} star${n > 1 ? "s" : ""}`}
                        aria-pressed={n <= rating}
                      >
                        ⭐
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="fb-role">
                    What do you do?{" "}
                    <span className="text-slate-500">(optional)</span>
                  </label>
                  <input
                    id="fb-role"
                    className="input"
                    placeholder="Freelance writer, designer…"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    maxLength={40}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="fb-msg">
                    Anything else?
                  </label>
                  <textarea
                    id="fb-msg"
                    className="input min-h-[90px] resize-y"
                    placeholder="What worked, what didn't, what you'd want next…"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={2000}
                  />
                </div>

                {/* Honeypot: hidden from users and assistive tech. */}
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: "-10000px",
                    width: "1px",
                    height: "1px",
                    overflow: "hidden",
                  }}
                >
                  <label htmlFor="fb-website">Website</label>
                  <input
                    id="fb-website"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>

                {err && <p className="text-sm text-red-300">{err}</p>}

                <button
                  type="submit"
                  disabled={state === "sending"}
                  className="btn-primary w-full"
                >
                  {state === "sending" ? (
                    <>
                      <Spinner /> Sending…
                    </>
                  ) : (
                    t("sendFeedbackLabel")
                  )}
                </button>
          </form>
        )}
      </Modal>
    </>
  );
}