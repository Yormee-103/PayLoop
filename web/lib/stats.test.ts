import { filterStatementInvoices, calculateStatementSummary } from "./stats";
import type { Invoice } from "./contract";

function makeInvoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: "1",
    freelancer: "GB_FREELANCER_1",
    client: "GB_CLIENT_1",
    token: "USDC",
    amount: 100_000_000n,
    description: "Web development services",
    dueDate: 0n,
    status: "Paid",
    createdAt: 1732000000n,
    paidAt: 1732000100n,
    ...overrides,
  };
}

describe("stats utilities", () => {
  describe("filterStatementInvoices", () => {
    const invoices: Invoice[] = [
      makeInvoice({
        id: "1",
        freelancer: "GB_ME",
        client: "GB_CLIENT_A",
        amount: 250_000_000n,
        status: "Paid",
        paidAt: 1730000000n, // ~Oct 27 2024
      }),
      makeInvoice({
        id: "2",
        freelancer: "GB_ME",
        client: "GB_CLIENT_B",
        amount: 500_000_000n,
        status: "Paid",
        paidAt: 1731000000n, // ~Nov 7 2024
      }),
      makeInvoice({
        id: "3",
        freelancer: "GB_ME",
        client: "GB_CLIENT_A",
        amount: 100_000_000n,
        status: "Pending", // Should be ignored
        paidAt: 0n,
      }),
      makeInvoice({
        id: "4",
        freelancer: "GB_SOMEONE_ELSE",
        client: "GB_ME",
        amount: 300_000_000n,
        status: "Paid", // Should be ignored (I am client, not freelancer)
        paidAt: 1731500000n,
      }),
    ];

    it("filters only paid invoices where freelancer matches", () => {
      const result = filterStatementInvoices(invoices, "GB_ME");
      expect(result.length).toBe(2);
      expect(result.map((i) => i.id)).toEqual(["2", "1"]); // newest first
    });

    it("filters by date range correctly", () => {
      // 1730000000 is 2024-10-27T14:13:20Z
      // 1731000000 is 2024-11-07T21:20:00Z
      const result = filterStatementInvoices(
        invoices,
        "GB_ME",
        "2024-11-01",
        "2024-11-30"
      );
      expect(result.length).toBe(1);
      expect(result[0].id).toBe("2");
    });

    it("returns empty array when wallet is empty or no match", () => {
      expect(filterStatementInvoices(invoices, "")).toEqual([]);
      expect(filterStatementInvoices(invoices, "GB_UNKNOWN")).toEqual([]);
    });
  });

  describe("calculateStatementSummary", () => {
    it("handles empty list gracefully", () => {
      const summary = calculateStatementSummary([]);
      expect(summary.totalPaidCount).toBe(0);
      expect(summary.totalIncome).toBe(0n);
      expect(summary.uniqueClientsCount).toBe(0);
      expect(summary.earliestPaidAt).toBeNull();
      expect(summary.latestPaidAt).toBeNull();
    });

    it("accurately computes totals, distinct clients, and timestamp range", () => {
      const invoices: Invoice[] = [
        makeInvoice({
          id: "1",
          amount: 150_000_000n,
          client: "CLIENT_A",
          paidAt: 1000n,
        }),
        makeInvoice({
          id: "2",
          amount: 250_000_000n,
          client: "CLIENT_B",
          paidAt: 2000n,
        }),
        makeInvoice({
          id: "3",
          amount: 100_000_000n,
          client: "CLIENT_A", // repeat client
          paidAt: 3000n,
        }),
      ];

      const summary = calculateStatementSummary(invoices);
      expect(summary.totalPaidCount).toBe(3);
      expect(summary.totalIncome).toBe(500_000_000n);
      expect(summary.uniqueClientsCount).toBe(2);
      expect(summary.earliestPaidAt).toBe(1000n);
      expect(summary.latestPaidAt).toBe(3000n);
    });
  });
});
