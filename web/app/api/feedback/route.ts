import { NextResponse } from "next/server";
import {
  feedbackRateLimiter,
  getClientIp,
  sanitizeMentions,
} from "@/lib/feedback";

// Feedback intake with comprehensive abuse protection:
//   - Body size cap (10 KB max payload)
//   - Per-IP rate limiting (5 submissions / min with Retry-After header)
//   - Honeypot protection for spam bot trapping
//   - Strict type & bounds validation for rating, role, address, message
//   - Neutralization of @channel / @everyone / @here mentions in outgoing webhook text
//   - Stateless sink forwarding (FEEDBACK_WEBHOOK_URL) with server-side tracing

type FeedbackBody = {
  rating?: number | null;
  message?: string;
  role?: string;
  address?: string;
  hp?: string;
  honeypot?: string;
  website?: string;
};

export async function POST(req: Request) {
  // 1. Body size cap (max 10 KB)
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 10240) {
    return NextResponse.json(
      { error: "Payload too large. Max request size is 10 KB." },
      { status: 400 }
    );
  }

  // 2. Per-IP rate limiting
  const clientIp = getClientIp(req);
  const { allowed, retryAfterSec } = feedbackRateLimiter.check(clientIp);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many feedback submissions. Please wait before trying again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSec),
        },
      }
    );
  }

  // 3. JSON body parsing
  let body: FeedbackBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  // 4. Honeypot protection: silently accept spam bot submissions without forwarding
  if (body.hp || body.honeypot || body.website) {
    console.warn(`[payloop:feedback] Honeypot triggered from ${clientIp}`);
    return NextResponse.json({ ok: true });
  }

  // 5. Strict field validation
  let rating: number | null = null;
  if (body.rating !== undefined && body.rating !== null) {
    const parsedRating = Number(body.rating);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return NextResponse.json(
        { error: "Rating must be an integer between 1 and 5." },
        { status: 400 }
      );
    }
    rating = parsedRating;
  }

  if (typeof body.message !== "undefined" && typeof body.message !== "string") {
    return NextResponse.json(
      { error: "Message must be a string." },
      { status: 400 }
    );
  }

  const message = (body.message ?? "").trim();
  if (message.length > 2000) {
    return NextResponse.json(
      { error: "Message must not exceed 2000 characters." },
      { status: 400 }
    );
  }

  if (rating === null && !message) {
    return NextResponse.json(
      { error: "Add a rating (1–5) or a message." },
      { status: 400 }
    );
  }

  const role = typeof body.role === "string" ? body.role.trim().slice(0, 40) : "";
  const address =
    typeof body.address === "string" ? body.address.trim().slice(0, 60) : "";

  // Record this valid submission against rate limiter
  feedbackRateLimiter.record(clientIp);

  const entry = {
    rating,
    message,
    role,
    address,
    receivedAt: new Date().toISOString(),
  };

  // 6. Forward to webhook sink with neutralized mentions
  const webhook = process.env.FEEDBACK_WEBHOOK_URL;
  if (webhook) {
    try {
      const sanitizedMessage = sanitizeMentions(entry.message || "(no message)");
      const sanitizedRole = sanitizeMentions(entry.role || "user");
      const sanitizedAddress = sanitizeMentions(entry.address || "n/a");

      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `PayLoop feedback — ${entry.rating ?? "?"}/5 (${sanitizedRole})\n${sanitizedMessage}\nwallet: ${sanitizedAddress}`,
          ...entry,
        }),
      });
    } catch {
      // Swallow: a failed webhook must not break user submission
    }
  }

  // Always leave a server-side trace so feedback is captured even with no sink
  console.log("[payloop:feedback]", JSON.stringify(entry));

  return NextResponse.json({ ok: true });
}
