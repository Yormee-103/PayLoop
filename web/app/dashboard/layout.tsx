import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — PayLoop",
  description:
    "Manage your invoices, view balances, track payments, and get test USDC.",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
