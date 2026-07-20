import { NextResponse } from "next/server";

// Feedback intake. Stores nothing itself; forwards each submission to whatever
// sink is configured via env, so the deployment stays stateless:
//   - FEEDBACK_WEBHOOK_URL: a generic webhook (Slack/Discord/Zapier/Make).
// If no sink is set we still 200 and log server-side, so the UX never breaks
// during a demo. Sentry (if configured) also captures it as a breadcrumb.

type FeedbackBody = {
  rating?: number;
  message?: string;
  role?: string;
  address?: string;
};

export async function POST(req: Request) {
  let body: FeedbackBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const rating = Number(body.rating);
  const message = (body.message ?? "").toString().slice(0, 2000).trim();

  if ((!Number.isFinite(rating) || rating < 1 || rating > 5) && !message) {
    return NextResponse.json(
      { error: "Add a rating (1–5) or a message." },
      { status: 400 }
    );
  }

  const entry = {
    rating: Number.isFinite(rating) ? rating : null,
    message,
    role: (body.role ?? "").toString().slice(0, 40),
    address: (body.address ?? "").toString().slice(0, 60),
    receivedAt: new Date().toISOString(),
  };

  const webhook = process.env.FEEDBACK_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `PayLoop feedback — ${entry.rating ?? "?"}/5 (${
            entry.role || "user"
          })\n${entry.message || "(no message)"}\nwallet: ${
            entry.address || "n/a"
          }`,
          ...entry,
        }),
      });
    } catch {
      // Swallow: a failed webhook must not break the user's submission.
    }
  }

  // Always leave a server-side trace so feedback is captured even with no sink.
  console.log("[payloop:feedback]", JSON.stringify(entry));

  return NextResponse.json({ ok: true });
}
