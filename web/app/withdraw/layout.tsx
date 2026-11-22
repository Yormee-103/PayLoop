import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Withdraw Funds — PayLoop",
  description:
    "Cash out your earned USDC into Nigerian Naira via off-ramp anchors.",
};

export default function WithdrawLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
