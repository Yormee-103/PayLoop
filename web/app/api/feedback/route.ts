import { NextResponse } from "next/server";

// Feedback intake. Stores nothing itself; forwards each submission to whatever
// sink is configured via env, so the deployment stays stateless:
//   - FEEDBACK_WEBHOOK_URL: a generic webhook (Slack/Discord/Zapier/Make).
// If no sink is set we still 200 and log server-side, so the UX never breaks
// during a demo. Sentry (if configured) also captures it as a breadcrumb.

const MAX_BODY_BYTES = 8 * 1024;
const RATE_LIMIT_PER_MINUTE = 5;
const RATE_WINDOW_MS = 60 * 1000;

// Per-IP fixed-window counters. In-memory, best-effort per instance; can be
// swapped for the shared store from lib/rate-limiter.ts when available.
const hits = new Map<string, { count: number; windowStart: number }>();

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Returns seconds to wait if over limit, else null. */
function checkRateLimit(ip: string): number | null {
  const now = Date.now();
  if (hits.size > 10_000) {
    for (const [k, v] of hits) {
      if (now - v.windowStart >= RATE_WINDOW_MS) hits.delete(k);
    }
  }
  const entry = hits.get(ip);
  if (!entry || now - entry.windowStart >= RATE_WINDOW_MS) {
    hits.set(ip, { count: 1, windowStart: now });
    return null;
  }
  if (entry.count >= RATE_LIMIT_PER_MINUTE) {
    return Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - entry.windowStart)) / 1000));
  }
  entry.count += 1;
  return null;
}

/** Neutralise mass mentions and links so the webhook cannot ping a channel. */
function neutralise(text: string): string {
  return text
    .replace(/@(channel|everyone|here)\b/gi, (m) => `@\u200b${m.slice(1)}`)
    .replace(/<!(channel|everyone|here)[^>]*>/gi, "[mention removed]")
    .replace(/https?:\/\//gi, (m) => m.replace("://", " [://] "))
    .replace(/<(https?|mailto):[^>]*>/gi, "[link removed]");
}

function str(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.slice(0, max).trim();
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const retryAfter = checkRateLimit(ip);
  if (retryAfter !== null) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large." }, { status: 400 });
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large." }, { status: 400 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const body = parsed as Record<string, unknown>;

  // Honeypot: real widget leaves this empty; bots fill it. Silently accept.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  let rating: number | null = null;
  if (body.rating !== undefined && body.rating !== null && body.rating !== "") {
    const r = Number(body.rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) {
      return NextResponse.json({ error: "Rating must be an integer from 1 to 5." }, { status: 400 });
    }
    rating = r;
  }

  if (body.message !== undefined && typeof body.message !== "string") {
    return NextResponse.json({ error: "Message must be text." }, { status: 400 });
  }
  if (body.role !== undefined && typeof body.role !== "string") {
    return NextResponse.json({ error: "Role must be text." }, { status: 400 });
  }
  if (body.address !== undefined && typeof body.address !== "string") {
    return NextResponse.json({ error: "Address must be text." }, { status: 400 });
  }

  const message = str(body.message, 2000);
  if (rating === null && !message) {
    return NextResponse.json(
      { error: "Add a rating (1–5) or a message." },
      { status: 400 },
    );
  }

  const entry = {
    rating,
    message,
    role: str(body.role, 40),
    address: str(body.address, 60),
    receivedAt: new Date().toISOString(),
  };

  const webhook = process.env.FEEDBACK_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: neutralise(
            `PayLoop feedback — ${entry.rating ?? "?"}/5 (${
              entry.role || "user"
            })\n${entry.message || "(no message)"}\nwallet: ${
              entry.address || "n/a"
            }`,
          ),
          ...entry,
          message: neutralise(entry.message),
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
