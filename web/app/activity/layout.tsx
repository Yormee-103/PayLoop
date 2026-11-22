import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Activity Feed — PayLoop",
  description:
    "Live public on-chain settlement activity and invoice statistics on Stellar.",
};

export default function ActivityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
