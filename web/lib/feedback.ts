// Feedback abuse protection utilities:
//   - Per-IP sliding window rate limiting
//   - Mention sanitization to prevent webhook spam / @everyone pings
//   - Client IP extraction

export interface FeedbackRateLimitStore {
  check(ip: string): { allowed: boolean; retryAfterSec: number };
  record(ip: string): void;
  reset(): void;
}

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5;
const ipSubmissions = new Map<string, number[]>();

export const feedbackRateLimiter: FeedbackRateLimitStore = {
  check(ip: string) {
    const now = Date.now();
    const timestamps = (ipSubmissions.get(ip) ?? []).filter(
      (t) => now - t < WINDOW_MS
    );
    if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
      const oldest = Math.min(...timestamps);
      const retryAfterSec = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
      return { allowed: false, retryAfterSec };
    }
    return { allowed: true, retryAfterSec: 0 };
  },
  record(ip: string) {
    const now = Date.now();
    const timestamps = (ipSubmissions.get(ip) ?? []).filter(
      (t) => now - t < WINDOW_MS
    );
    timestamps.push(now);
    ipSubmissions.set(ip, timestamps);
  },
  reset() {
    ipSubmissions.clear();
  },
};

/**
 * Neutralizes Slack/Discord broadcast mentions (@channel, @everyone, @here, etc.)
 * by injecting an invisible zero-width space after the '@' symbol.
 */
export function sanitizeMentions(input: string): string {
  if (!input) return "";
  return input
    .replace(/@/g, "@\u200B")
    .replace(/<!(channel|everyone|here)>/gi, "<!\u200B$1>")
    .replace(/<@(everyone|here|[!&]?[0-9a-zA-Z]+)>/g, "<@\u200B$1>");
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "127.0.0.1";
}
