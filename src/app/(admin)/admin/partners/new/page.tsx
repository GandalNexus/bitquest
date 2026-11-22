import { ContentLink as Link } from "@/components/admin/content-link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminOrDenied } from "../../_require-admin";
import { PartnerForm } from "../partner-form";

export const metadata = { title: "Nouveau partenaire — GandalNexus" };

export default async function NewPartnerPage() {
  const gate = await requireAdminOrDenied();
  if (!gate.ok) return gate.element;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/partners">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour aux partenaires
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Nouveau partenaire</CardTitle>
          <CardDescription>
            Ajouter un sponsor, partenaire ou soutien à la landing publique{" "}
            <code>/gandalnexus</code>. Mets en brouillon pour préparer sans l&apos;afficher
            immédiatement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PartnerForm
            mode="create"
            initial={{
              name: "",
              tier: "PARTNER",
              description: "",
              websiteUrl: "",
              logoUrl: "",
              initials: "",
              order: 0,
              publishedAt: null,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
