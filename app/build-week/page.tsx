import type { Metadata } from "next";

import { BuildWeekDeck } from "@/app/components/BuildWeekDeck";

export const metadata: Metadata = {
  title: "OpenAI Build Week 2026",
  description: "Preuvance — instant AI assurance, evidence by evidence.",
  robots: { index: false, follow: false },
};

export default function BuildWeekPage() {
  return <BuildWeekDeck />;
}
