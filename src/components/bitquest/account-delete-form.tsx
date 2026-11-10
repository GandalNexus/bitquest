"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, clearStoredSession } from "@/lib/bitquest/client";
import { useBitQuest } from "@/lib/bitquest/store";

/**
 * Suppression RGPD. Collapsable (hidden par défaut) pour éviter les clics
 * accidentels. Confirmation par string "DELETE" + password si registered.
 */
export function AccountDeleteForm({ isGuest }: { isGuest: boolean }) {
  const logout = useBitQuest((s) => s.logout);
  const [opened, setOpened] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (confirmation !== "DELETE") {
      setError('Tape exactement "DELETE" pour confirmer.');
      return;
    }
    setPending(true);
    try {
      await api.deleteAccount({
        confirmation: "DELETE",
        currentPassword: isGuest ? undefined : password,
      });
      clearStoredSession();
      logout();
      // Reload pour remettre l'AuthScreen propre.
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
      setPending(false);
    }
  };

  if (!opened) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpened(true)}
        className="border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        Supprimer mon compte
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-md border border-destructive/30 bg-destructive/5 p-4">
      <div>
        <h3 className="text-sm font-semibold text-destructive">Supprimer définitivement ce compte</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Ton pseudo et ton email seront anonymisés, ton mot de passe effacé, tes sessions
          invalidées. Les statistiques globales (classement, badges d&apos;autres utilisateurs)
          conservent leur cohérence. Cette action est irréversible côté interface.
        </p>
      </div>

      {!isGuest && (
        <div className="space-y-1.5">
          <Label htmlFor="delete-password" className="text-sm font-medium">
            Mot de passe actuel
          </Label>
          <Input
            id="delete-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="delete-confirm" className="text-sm font-medium">
          Tape <code className="rounded bg-destructive/10 px-1 font-mono text-destructive">DELETE</code> pour confirmer
        </Label>
        <Input
          id="delete-confirm"
          type="text"
          autoComplete="off"
          required
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
        />
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpened(false);
            setConfirmation("");
            setPassword("");
            setError(null);
          }}
        >
          Annuler
        </Button>
        <Button
          type="submit"
          disabled={pending || confirmation !== "DELETE"}
          variant="outline"
          className="border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Suppression…
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4" aria-hidden />
              Supprimer définitivement
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
