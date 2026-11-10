"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, Coins, Flame, Loader2, Sparkles, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, formatSats } from "@/lib/bitquest/client";
import { useInvalidateAll } from "@/lib/bitquest/hooks";
import { useToast } from "@/hooks/use-toast";

/**
 * Tuile « Défi du jour » (Phase 2.8).
 *
 * - Fetch /api/challenges/today côté client (auth optionnelle).
 * - Si aucun défi → tuile cachée.
 * - Si déjà validé → badge « Déjà validé ».
 * - Sinon → bouton Valider le défi qui invalide ensuite me/quests/wallet.
 */
export function DailyChallengeTile() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidateAll = useInvalidateAll();

  const query = useQuery({
    queryKey: ["challenges", "today"],
    queryFn: api.todayChallenge,
    retry: 0,
  });

  const mutation = useMutation({
    mutationFn: api.completeChallenge,
    onSuccess: (res) => {
      if (res.alreadyCompleted) {
        toast({ title: "Déjà validé aujourd'hui.", description: "Reviens demain pour un nouveau défi." });
      } else {
        const bits: string[] = [];
        if (res.xpGained > 0) bits.push(`+${res.xpGained} XP`);
        if (res.satsGranted > 0) bits.push(`+${formatSats(res.satsGranted)} sats`);
        toast({
          title: "Défi validé !",
          description:
            bits.length > 0
              ? bits.join(" · ") + (res.satsCapped ? " (plafond journalier atteint)" : "")
              : "Bravo.",
        });
      }
      qc.invalidateQueries({ queryKey: ["challenges"] });
      invalidateAll();
    },
    onError: (err) => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible de valider.",
      });
    },
  });

  if (query.isLoading) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="rounded-xl">
          <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Chargement du défi du jour…
          </CardContent>
        </Card>
      </motion.section>
    );
  }

  const challenge = query.data?.challenge;
  if (!challenge) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      aria-labelledby="dashboard-challenge-title"
    >
      <Card className="rounded-xl border-amber-500/30 bg-amber-500/5">
        <CardHeader className="gap-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle id="dashboard-challenge-title" className="flex items-center gap-2 text-base">
              <Flame className="h-5 w-5 text-amber-500" aria-hidden />
              Défi du jour
            </CardTitle>
            {challenge.completed ? (
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-500">
                <CheckCircle2 className="h-3 w-3" aria-hidden />
                Déjà validé
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-500">
                <Sparkles className="h-3 w-3" aria-hidden />
                Nouveau
              </Badge>
            )}
          </div>
          <CardDescription className="text-sm font-medium text-foreground">
            {challenge.title}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{challenge.prompt}</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                <Star className="h-3 w-3" aria-hidden />
                +{challenge.xpReward} XP
              </Badge>
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-500">
                <Coins className="h-3 w-3" aria-hidden />
                +{formatSats(challenge.satsReward)} sats
              </Badge>
            </div>
            <Button
              onClick={() => mutation.mutate()}
              disabled={challenge.completed || mutation.isPending}
              size="sm"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Validation…
                </>
              ) : challenge.completed ? (
                "Déjà validé"
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  Valider le défi
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.section>
  );
}
