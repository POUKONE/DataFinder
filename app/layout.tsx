import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = process.env.DATAFINDER_PUBLIC_URL?.replace(/\/$/, "") ?? `${protocol}://${host}`;
  const title = "DataFinder — Trouvez les bonnes données";
  const description = "Recherche intelligente, comparaison et recommandation de datasets fiables pour vos projets.";
  return {
    metadataBase: new URL(origin),
    title,
    description,
    openGraph: { title, description, type: "website", locale: "fr_FR", images: [{ url: `${origin}/og.png`, width: 1731, height: 909, alt: "DataFinder — Les bonnes données, sans perdre des heures" }] },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
