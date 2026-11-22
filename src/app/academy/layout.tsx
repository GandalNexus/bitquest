import type { Metadata } from "next";
import { AcademyProviders } from "./providers";
import { PublicNav } from "@/components/bitquest/public-nav";

export const metadata: Metadata = {
  title: "Académie — BitQuest",
  description:
    "Apprends Bitcoin à travers des cours structurés : parcours thématiques, chapitres, leçons illustrées. Complémentaire aux quêtes gamifiées.",
};

export default function AcademyLayout({ children }: { children: React.ReactNode }) {
  return (
    <AcademyProviders>
      <PublicNav />
      {children}
    </AcademyProviders>
  );
}
