import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "./route";
import {
  sanitizeMentions,
  feedbackRateLimiter,
} from "@/lib/feedback";

describe("Feedback Abuse Protection & Route Handler", () => {
  beforeEach(() => {
    feedbackRateLimiter.reset();
  });

  describe("sanitizeMentions", () => {
    it("neutralizes @channel, @everyone, and @here with zero-width space", () => {
      const input = "Hey @channel and @everyone, look @here!";
      const result = sanitizeMentions(input);
      expect(result).not.toContain("@channel");
      expect(result).not.toContain("@everyone");
      expect(result).not.toContain("@here");
      expect(result).toContain("@\u200Bchannel");
      expect(result).toContain("@\u200Beveryone");
      expect(result).toContain("@\u200Bhere");
    });

    it("neutralizes Slack-style mention tags", () => {
      const input = "Alert <!channel> and <@U123456>";
      const result = sanitizeMentions(input);
      expect(result).toContain("<!\u200Bchannel>");
      expect(result).toContain("<@\u200BU123456>");
    });

    it("handles empty or benign text gracefully", () => {
      expect(sanitizeMentions("")).toBe("");
      expect(sanitizeMentions("Great application!")).toBe("Great application!");
    });
  });

  describe("feedbackRateLimiter", () => {
    it("allows up to 5 submissions per minute per IP", () => {
      const testIp = "192.168.1.100";
      for (let i = 0; i < 5; i++) {
        const check = feedbackRateLimiter.check(testIp);
        expect(check.allowed).toBe(true);
        expect(check.retryAfterSec).toBe(0);
        feedbackRateLimiter.record(testIp);
      }

      // 6th request within window must be rejected
      const blocked = feedbackRateLimiter.check(testIp);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterSec).toBeGreaterThan(0);
      expect(blocked.retryAfterSec).toBeLessThanOrEqual(60);
    });

    it("tracks different IPs independently", () => {
      const ip1 = "10.0.0.1";
      const ip2 = "10.0.0.2";

      for (let i = 0; i < 5; i++) {
        feedbackRateLimiter.record(ip1);
      }

      expect(feedbackRateLimiter.check(ip1).allowed).toBe(false);
      expect(feedbackRateLimiter.check(ip2).allowed).toBe(true);
    });
  });

  describe("POST /api/feedback", () => {
    it("returns 400 when body size exceeds 10KB limit", async () => {
      const req = new Request("http://localhost:3000/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": "15000",
        },
        body: JSON.stringify({ message: "large" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/Payload too large/i);
    });

    it("returns 400 on malformed JSON body", async () => {
      const req = new Request("http://localhost:3000/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json ...",
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Invalid JSON body.");
    });

    it("returns 400 when rating is out of bounds or not an integer", async () => {
      const invalidRatings = [0, 6, 3.5, -1, "five"];
      for (const rating of invalidRatings) {
        const req = new Request("http://localhost:3000/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating }),
        });

        const res = await POST(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/Rating must be an integer between 1 and 5/i);
      }
    });

    it("returns 400 when neither rating nor message is provided", async () => {
      const req = new Request("http://localhost:3000/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "developer" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Add a rating (1–5) or a message.");
    });

    it("silently absorbs honeypot submissions with 200 OK without recording rate limits", async () => {
      const req = new Request("http://localhost:3000/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "172.16.0.5",
        },
        body: JSON.stringify({
          rating: 5,
          message: "Buy cheap crypto here",
          hp: "http://spambot.example.com",
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);

      // Verify honeypot submission was not counted against legitimate limit
      expect(feedbackRateLimiter.check("172.16.0.5").allowed).toBe(true);
    });

    it("returns 200 on valid feedback submission and increments rate limit counter", async () => {
      const testIp = "192.168.1.50";
      const req = new Request("http://localhost:3000/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": testIp,
        },
        body: JSON.stringify({
          rating: 4,
          message: "Great user interface and speedy payments!",
          role: "freelancer",
          address: "GBDEVTESTWALLET1234567890",
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it("returns 429 with Retry-After when IP rate limit is exceeded", async () => {
      const spamIp = "10.10.10.10";
      for (let i = 0; i < 5; i++) {
        const req = new Request("http://localhost:3000/api/feedback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": spamIp,
          },
          body: JSON.stringify({ rating: 5, message: `Feedback ${i}` }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
      }

      // 6th request triggers 429
      const reqBlocked = new Request("http://localhost:3000/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": spamIp,
        },
        body: JSON.stringify({ rating: 5, message: "Spam message" }),
      });
      const resBlocked = await POST(reqBlocked);
      expect(resBlocked.status).toBe(429);
      expect(resBlocked.headers.get("Retry-After")).toBeDefined();
      const data = await resBlocked.json();
      expect(data.error).toMatch(/Too many feedback submissions/i);
    });
  });
});
