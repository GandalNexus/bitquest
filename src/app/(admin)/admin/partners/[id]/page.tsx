import { notFound } from "next/navigation";
import { ContentLink as Link } from "@/components/admin/content-link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminOrDenied } from "../../_require-admin";
import { PartnerForm } from "../partner-form";
import type { PartnerTier } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Éditer un partenaire — GandalNexus" };

export default async function EditPartnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const gate = await requireAdminOrDenied();
  if (!gate.ok) return gate.element;

  const { id } = await params;
  const partner = await db.partner.findUnique({ where: { id } });
  if (!partner) notFound();

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
          <CardTitle>Éditer : {partner.name}</CardTitle>
          <CardDescription>Modifier les informations du partenaire.</CardDescription>
        </CardHeader>
        <CardContent>
          <PartnerForm
            mode="edit"
            initial={{
              id: partner.id,
              name: partner.name,
              tier: partner.tier as PartnerTier,
              description: partner.description,
              websiteUrl: partner.websiteUrl ?? "",
              logoUrl: partner.logoUrl ?? "",
              initials: partner.initials,
              order: partner.order,
              publishedAt: partner.publishedAt ? partner.publishedAt.toISOString() : null,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
