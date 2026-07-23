import type { Metadata } from "next";

import { BuildWeekDeck } from "@/app/components/BuildWeekDeck";

export const metadata: Metadata = {
  title: "Build Week OpenAI 2026",
  description:
    "Présentation Preuvance pour la Build Week OpenAI 2026 : parcours Prompt · Scan · Prove, chaîne GPT-5.6 relue par des règles déterministes, preuves construites.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/build-week" },
};

export default function BuildWeekPage() {
  return <BuildWeekDeck />;
}
