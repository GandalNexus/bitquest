import type { Metadata } from "next";
import { Orbitron, Exo_2, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { LocaleProvider } from "@/i18n/locale-provider";
import { getServerLocale } from "@/i18n/server";

/* Charte BitQuest : Orbitron (display & logos) + Exo 2 (texte courant) */
const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
});

const exo2 = Exo_2({
  variable: "--font-exo2",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BitQuest — Apprends Bitcoin, quête après quête",
  description:
    "BitQuest est la plateforme apprendre → pratiquer → gagner dédiée à la communauté Bitcoin : quêtes gamifiées, missions BitLab, XP, badges et satoshis pédagogiques. Open-source — de l'Afrique vers le monde.",
  keywords: [
    "BitQuest",
    "BitLab",
    "Bitcoin",
    "Lightning Network",
    "apprentissage",
    "gamification",
    "satoshis",
    "open-source",
  ],
  authors: [{ name: "BitQuest" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "BitQuest — Apprends Bitcoin, quête après quête",
    description:
      "Apprends, pratique et gagne des satoshis avec BitQuest. Open-source — de l'Afrique vers le monde.",
    siteName: "BitQuest",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getServerLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${orbitron.variable} ${exo2.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground`}
      >
        <LocaleProvider initial={locale}>
          {children}
          <Toaster />
        </LocaleProvider>
      </body>
    </html>
  );
}
