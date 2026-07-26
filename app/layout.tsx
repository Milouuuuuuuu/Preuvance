import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { resolveBaseUrlFromHeaders } from "@/lib/base-url";
import { PostHogProvider } from "./components/PostHogProvider";
import { ThemeToggle } from "./components/ThemeToggle";
import "./globals.css";

// Pose data-theme avant la première peinture pour éviter le flash clair quand
// le visiteur a choisi le mode nuit (D-105). Aucune entrée utilisateur n'est
// interprétée : seule la valeur exacte « nuit » est honorée.
const themeInitScript =
  'try{if(localStorage.getItem("pv-theme")==="nuit"){document.documentElement.dataset.theme="nuit"}}catch(e){}';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "Preuvance — Préparez la preuve de votre risque IA";
const description =
  "Transformez la description de votre système IA en dossier de préparation courtier, daté et traçable.";

async function resolveBaseUrl(): Promise<URL> {
  return resolveBaseUrlFromHeaders(await headers());
}

export async function generateMetadata(): Promise<Metadata> {
  const metadataBase = await resolveBaseUrl();
  const imageUrl = new URL("/og-evidence-dossier.png", metadataBase).toString();

  return {
    metadataBase,
    title: {
      default: title,
      template: "%s · Preuvance",
    },
    description,
    applicationName: "Preuvance",
    category: "compliance",
    robots: { index: true, follow: true },
    keywords: [
      "EU AI Act",
      "article 50",
      "conformité IA PME",
      "dossier de preuve IA",
      "shadow AI",
      "registre de preuves",
    ],
    openGraph: {
      type: "website",
      locale: "fr_FR",
      siteName: "Preuvance",
      title,
      description,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const origin = (await resolveBaseUrl()).origin;
  // JSON-LD strictement factuel : aucune note agrégée, aucun avis, aucun
  // décompte d’utilisateurs ni certification (D-081). L’offre gratuite décrit
  // uniquement le scan local réellement téléchargeable sans compte.
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${origin}/#organisation`,
        name: "Preuvance",
        url: `${origin}/`,
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#site`,
        name: "Preuvance",
        url: `${origin}/`,
        inLanguage: "fr",
        publisher: { "@id": `${origin}/#organisation` },
      },
      {
        "@type": "WebApplication",
        "@id": `${origin}/#application`,
        name: "Preuvance",
        url: `${origin}/`,
        description,
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Préparation à la conformité EU AI Act",
        inLanguage: "fr",
        publisher: { "@id": `${origin}/#organisation` },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "EUR",
          description:
            "Téléchargement et scan local gratuits, sans compte ni envoi de données.",
        },
      },
    ],
  };

  return (
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <PostHogProvider>{children}</PostHogProvider>
        <ThemeToggle />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
      </body>
    </html>
  );
}
