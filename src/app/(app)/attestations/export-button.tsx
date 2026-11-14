"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

/**
 * Bouton « Exporter » sur chaque Attestation (LOT 28).
 * POST /api/me/attestations/[id]/certificate → signedBlob .enc à DL.
 */
export function ExportCertificateButton({
  attestationId,
  targetCode,
}: {
  attestationId: string;
  targetCode: string;
}) {
  const [pending, setPending] = useState(false);

  const csrf =
    typeof document !== "undefined"
      ? (document.cookie.split("; ").find((c) => c.startsWith("bq_csrf="))?.split("=")[1] ?? "")
      : "";

  const onExport = async () => {
    setPending(true);
    try {
      const res = await fetch(
        `/api/me/attestations/${encodeURIComponent(attestationId)}/certificate`,
        {
          method: "POST",
          credentials: "include",
          headers: { "X-CSRF-Token": decodeURIComponent(csrf) },
        },
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: "Erreur inconnue" }))) as {
          error?: string;
        };
        toast({
          variant: "destructive",
          title: "Export impossible",
          description: err.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      const body = (await res.json()) as { signedBlob: string; certificateId: string };
      const blob = new Blob([body.signedBlob], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bitquest-certificate-${targetCode}-${body.certificateId.slice(0, 8)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Certificat exporté",
        description: "Fichier téléchargé — stocke-le ou partage-le.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Export échoué",
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onExport}
      disabled={pending}
      className="gap-1.5"
    >
      <Download className="h-3.5 w-3.5" />
      {pending ? "…" : "Exporter"}
    </Button>
  );
}
