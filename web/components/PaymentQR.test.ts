import { describe, it, expect } from "vitest";

describe("PaymentQR link builder", () => {
  it("formats the payment URL correctly for a given invoice ID", () => {
    const origin = "https://payloop.app";
    const invoiceId = "42";
    const payUrl = `${origin}/pay/${invoiceId}`;
    expect(payUrl).toBe("https://payloop.app/pay/42");
  });

  it("handles alphanumeric invoice IDs", () => {
    const origin = "https://payloop.app";
    const invoiceId = "inv_abc123";
    const payUrl = `${origin}/pay/${invoiceId}`;
    expect(payUrl).toBe("https://payloop.app/pay/inv_abc123");
  });
});
