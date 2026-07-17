import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

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

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost ?? requestHeaders.get("host");
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol = forwardedProtocol === "http" ? "http" : "https";
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  const metadataBase = host
    ? new URL(`${protocol}://${host}`)
    : new URL(configuredUrl ?? "http://localhost:3000");
  const imageUrl = new URL("/og-v2.png", metadataBase).toString();

  return {
    metadataBase,
    title: {
      default: title,
      template: "%s · Preuvance",
    },
    description,
    applicationName: "Preuvance",
    category: "compliance",
    openGraph: {
      type: "website",
      locale: "fr_FR",
      siteName: "Preuvance",
      title,
      description,
      images: [{ url: imageUrl, width: 1728, height: 910, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
