import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invoice History — PayLoop",
  description:
    "Browse and filter all your sent and received invoices with full on-chain status.",
};

export default function HistoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
