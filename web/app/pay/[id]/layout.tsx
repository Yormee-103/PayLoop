import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pay Invoice — PayLoop",
  description:
    "Review and pay this invoice in USDC on the Stellar network with instant settlement.",
};

export default function PayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
