import { describe, expect, it } from "vitest";
import { dueDateToUnix, isOverdue } from "./date";
import { formatDate } from "./format";

describe("dueDateToUnix & isOverdue logic", () => {
  it("returns 0n for empty, null, or malformed date strings", () => {
    expect(dueDateToUnix("")).toBe(0n);
    expect(dueDateToUnix(null)).toBe(0n);
    expect(dueDateToUnix("invalid-date")).toBe(0n);
    expect(dueDateToUnix("2026-99")).toBe(0n);
  });

  it("sets the timestamp to the end of the day in local time (23:59:59)", () => {
    const unix = dueDateToUnix("2026-11-25");
    expect(unix).toBeGreaterThan(0n);

    const d = new Date(Number(unix) * 1000);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(10); // 0-indexed November
    expect(d.getDate()).toBe(25);
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
    expect(d.getSeconds()).toBe(59);
  });

  it("an invoice due today is not overdue until the day has ended", () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;

    const dueUnix = dueDateToUnix(todayStr);

    // Right now (during today's daytime), it must NOT be overdue
    expect(
      isOverdue({
        status: "Pending",
        dueDate: dueUnix,
      })
    ).toBe(false);

    // After end of today (tomorrow morning), it IS overdue
    const tomorrowMs = Number(dueUnix) * 1000 + 1000;
    expect(
      isOverdue(
        {
          status: "Pending",
          dueDate: dueUnix,
        },
        tomorrowMs
      )
    ).toBe(true);
  });

  it("paid invoices are never overdue", () => {
    const pastUnix = BigInt(Math.floor(Date.now() / 1000) - 86400);
    expect(
      isOverdue({
        status: "Paid",
        dueDate: pastUnix,
      })
    ).toBe(false);
  });

  it("invoices without due date (0n) are never overdue", () => {
    expect(
      isOverdue({
        status: "Pending",
        dueDate: 0n,
      })
    ).toBe(false);
  });

  it("formatDate displays the exact picked date across timezones for legacy UTC midnight and end-of-day timestamps", () => {
    // End-of-day local timestamp
    const unix = dueDateToUnix("2026-11-25");
    const formatted = formatDate(unix);
    expect(formatted).toContain("Nov 25, 2026");

    // Legacy UTC midnight timestamp (2026-11-25T00:00:00Z -> 1795564800)
    const legacyUtcMidnight = 1795564800; // divisible by 86400
    const legacyFormatted = formatDate(legacyUtcMidnight);
    expect(legacyFormatted).toContain("Nov 25, 2026");
  });
});
