import { describe, expect, it } from "vitest";
import { shouldAutoOpenTour } from "./tour";

describe("shouldAutoOpenTour", () => {
  it("does not auto-open if user has already seen the tour", () => {
    expect(shouldAutoOpenTour("/", true)).toBe(false);
    expect(shouldAutoOpenTour("/dashboard", true)).toBe(false);
    expect(shouldAutoOpenTour("/create", true)).toBe(false);
    expect(shouldAutoOpenTour("/pay/123", true)).toBe(false);
  });

  it("does not auto-open on direct payment routes (/pay/*) on first visit", () => {
    expect(shouldAutoOpenTour("/pay/1", false)).toBe(false);
    expect(shouldAutoOpenTour("/pay/abc-xyz", false)).toBe(false);
    expect(shouldAutoOpenTour("/pay", false)).toBe(false);
  });

  it("auto-opens on home, dashboard, create, and other routes on first visit", () => {
    expect(shouldAutoOpenTour("/", false)).toBe(true);
    expect(shouldAutoOpenTour("/dashboard", false)).toBe(true);
    expect(shouldAutoOpenTour("/create", false)).toBe(true);
    expect(shouldAutoOpenTour("/history", false)).toBe(true);
    expect(shouldAutoOpenTour("/help", false)).toBe(true);
    expect(shouldAutoOpenTour(null, false)).toBe(true);
    expect(shouldAutoOpenTour(undefined, false)).toBe(true);
  });
});
