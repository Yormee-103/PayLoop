import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pitch Deck — PayLoop",
  description:
    "Learn about PayLoop, the problem we solve, our Stellar Soroban architecture, and market traction.",
};

export default function PitchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
