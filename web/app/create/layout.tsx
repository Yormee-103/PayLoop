import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Invoice — PayLoop",
  description:
    "Create and issue a smart-contract invoice in USDC on Stellar.",
};

export default function CreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
