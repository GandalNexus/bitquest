"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, storeSession } from "@/lib/bitquest/client";
import { useBitQuest } from "@/lib/bitquest/store";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/i18n/locale-provider";

/**
 * Formulaire de changement de mot de passe (compte enregistré uniquement).
 * Le serveur rote le token : on persiste le nouveau en localStorage pour
 * que la session reste valide pour les appels header-legacy, et on garde
 * les cookies (ré-émis par le serveur).
 */
export function PasswordChangeForm({ userId }: { userId: string }) {
  const { toast } = useToast();
  const t = useT();
  const setSession = useBitQuest((s) => s.setSession);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError(t("account.password.error.mismatch"));
      return;
    }
    if (next.length < 6) {
      setError(t("account.password.error.tooShort"));
      return;
    }
    setPending(true);
    try {
      const res = await api.changePassword({ currentPassword: current, newPassword: next });
      storeSession(userId, res.token);
      setSession(userId, res.token);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast({
        title: t("account.password.toast.title"),
        description: t("account.password.toast.description"),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknownError"));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="pwd-current" className="text-sm font-medium">
          {t("account.password.current")}
        </Label>
        <Input
          id="pwd-current"
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pwd-new" className="text-sm font-medium">
            {t("account.password.new")}
          </Label>
          <Input
            id="pwd-new"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pwd-confirm" className="text-sm font-medium">
            {t("account.password.confirm")}
          </Label>
          <Input
            id="pwd-confirm"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
      </div>
      {error && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t("account.password.submitting")}
            </>
          ) : (
            <>
              <KeyRound className="h-4 w-4" aria-hidden />
              {t("account.password.submit")}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
