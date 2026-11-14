"use client";

import { useState } from "react";
import { Download, Link as LinkIcon } from "lucide-react";
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

  const requestBlob = async (): Promise<{ blob: string; id: string } | null> => {
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
        title: "Certificat indisponible",
        description: err.error ?? `HTTP ${res.status}`,
      });
      return null;
    }
    const body = (await res.json()) as { signedBlob: string; certificateId: string };
    return { blob: body.signedBlob, id: body.certificateId };
  };

  const onExport = async () => {
    setPending(true);
    try {
      const result = await requestBlob();
      if (!result) return;
      const file = new Blob([result.blob], { type: "text/plain" });
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bitquest-certificate-${targetCode}-${result.id.slice(0, 8)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Certificat exporté",
        description: "Fichier téléchargé — stocke-le ou partage-le.",
      });
    } finally {
      setPending(false);
    }
  };

  const onCopyShareLink = async () => {
    setPending(true);
    try {
      const result = await requestBlob();
      if (!result) return;
      const url = `${window.location.origin}/verify?blob=${encodeURIComponent(result.blob)}`;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast({
          title: "Lien partageable copié",
          description: "Toute personne avec cette URL peut vérifier le certificat.",
        });
      } else {
        // Fallback : ouvrir dans un nouvel onglet pour copie manuelle
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
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
      <Button
        size="sm"
        variant="ghost"
        onClick={onCopyShareLink}
        disabled={pending}
        title="Copier un lien de vérification partageable"
        className="gap-1.5"
      >
        <LinkIcon className="h-3.5 w-3.5" />
        Lien
      </Button>
    </div>
  );
}
