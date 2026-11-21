import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryRateLimiter, RateLimiterConfig } from "./rate-limiter";

const TEST_CONFIG: RateLimiterConfig = {
  perIpLimitPerHour: 3,
  globalDailyCapTokens: 1_000_000_000n,
};

describe("InMemoryRateLimiter", () => {
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    limiter = new InMemoryRateLimiter(TEST_CONFIG);
  });

  describe("checkLimit and recordMint", () => {
    it("allows first mint for new IP and address", async () => {
      const result = await limiter.checkLimit("192.168.1.1", "GADDRESS1");
      expect(result).toBeNull();
    });

    it("blocks second mint to same address within window", async () => {
      const ip = "192.168.1.1";
      const address = "GADDRESS1";

      // First mint should succeed
      expect(await limiter.checkLimit(ip, address)).toBeNull();
      await limiter.recordMint(ip, address, 5_000_000_000n);

      // Second mint to same address should be blocked
      const result = await limiter.checkLimit(ip, address);
      expect(result).not.toBeNull();
      expect(result).toBeGreaterThan(0);
    });

    it("enforces per-IP limit", async () => {
      const ip = "192.168.1.1";
      const addresses = ["GADDRESS1", "GADDRESS2", "GADDRESS3", "GADDRESS4"];

      // Record mints up to the limit
      for (let i = 0; i < TEST_CONFIG.perIpLimitPerHour; i++) {
        expect(await limiter.checkLimit(ip, addresses[i])).toBeNull();
        await limiter.recordMint(ip, addresses[i], 5_000_000_000n);
      }

      // Next mint from same IP should be blocked
      const result = await limiter.checkLimit(ip, addresses[3]);
      expect(result).not.toBeNull();
    });

    it("allows different IPs independent limits", async () => {
      const addr1 = "GADDRESS1";
      const addr2 = "GADDRESS2";
      const ip1 = "192.168.1.1";
      const ip2 = "192.168.1.2";

      // First IP mints
      expect(await limiter.checkLimit(ip1, addr1)).toBeNull();
      await limiter.recordMint(ip1, addr1, 5_000_000_000n);

      // Second IP with different address should be allowed
      expect(await limiter.checkLimit(ip2, addr2)).toBeNull();
      await limiter.recordMint(ip2, addr2, 5_000_000_000n);
    });
  });

  describe("getDailyTotal", () => {
    it("tracks total mints", async () => {
      expect(await limiter.getDailyTotal()).toBe(0n);

      await limiter.recordMint("192.168.1.1", "GADDRESS1", 5_000_000_000n);
      expect(await limiter.getDailyTotal()).toBe(5_000_000_000n);

      await limiter.recordMint("192.168.1.2", "GADDRESS2", 3_000_000_000n);
      expect(await limiter.getDailyTotal()).toBe(8_000_000_000n);
    });
  });
});
