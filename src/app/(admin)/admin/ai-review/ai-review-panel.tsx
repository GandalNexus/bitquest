"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronUp, Pencil, Sparkles, X } from "lucide-react";
import { readCookie } from "@/lib/bitquest/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PendingButton } from "@/components/ui/pending-button";
import { useToast } from "@/hooks/use-toast";
import { DraftEditor } from "./draft-editor";
import { SearchableSelect } from "@/components/admin/searchable-select";

type DraftType = "QUEST" | "LESSON" | "CHAPTER" | "CHALLENGE";
type GenerationMode = "NEW" | "COURSE_FILL" | "ENRICH" | "DAILY";
type Audience = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
type ChallengeFormat = "QUESTION" | "QUIZ" | "MINI_TASK" | "OBSERVATION";

interface DraftRow {
  id: string;
  type: string;
  status: string;
  payload: string;
  aiModel: string;
  rejectReason: string | null;
  publishedId: string | null;
  createdAt: string;
  reviewedAt: string | null;
  tokensInput: number | null;
  tokensOutput: number | null;
}

interface CourseOption {
  slug: string;
  title: string;
  published: boolean;
  chapters: Array<{ slug: string; title: string }>;
}

const TYPE_LABEL: Record<DraftType, string> = {
  QUEST: "Quête",
  LESSON: "Leçon",
  CHAPTER: "Chapitre",
  CHALLENGE: "Défi quotidien",
};

const MODE_LABEL: Record<GenerationMode, string> = {
  NEW: "Nouveau contenu (idée libre)",
  COURSE_FILL: "Compléter un cours existant",
  ENRICH: "Enrichir un chapitre existant",
  DAILY: "Défi quotidien thématique",
};

const AUDIENCE_LABEL: Record<Audience, string> = {
  BEGINNER: "Débutant",
  INTERMEDIATE: "Intermédiaire",
  ADVANCED: "Avancé",
};

export function AIReviewPanel({
  drafts,
  courses,
}: {
  drafts: DraftRow[];
  courses: CourseOption[];
}) {
  const pending = drafts.filter((d) => d.status === "PENDING");
  const history = drafts.filter((d) => d.status !== "PENDING");

  return (
    <div className="space-y-6">
      <GenerationForm courses={courses} />

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            En attente de review ({pending.length})
          </h2>
          {pending.map((d) => (
            <DraftCard key={d.id} draft={d} />
          ))}
        </section>
      )}

      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Historique récent
          </h2>
          {history.map((d) => (
            <HistoryRow key={d.id} draft={d} />
          ))}
        </section>
      )}
    </div>
  );
}

/* ========================================================================
 * Formulaire de génération
 * ====================================================================== */
function GenerationForm({ courses }: { courses: CourseOption[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [generating, setGenerating] = useState(false);
  const [advanced, setAdvanced] = useState(false);

  const [mode, setMode] = useState<GenerationMode>("NEW");
  const [type, setType] = useState<DraftType>("QUEST");
  const [subject, setSubject] = useState("");
  const [audience, setAudience] = useState<Audience>("BEGINNER");
  const [objective, setObjective] = useState("");
  const [concepts, setConcepts] = useState("");
  const [constraints, setConstraints] = useState("");
  const [courseSlug, setCourseSlug] = useState<string>("");
  const [chapterSlug, setChapterSlug] = useState<string>("");
  const [challengeFormat, setChallengeFormat] = useState<ChallengeFormat>("QUESTION");

  // Modes verrouillent partiellement les types pour éviter les combinaisons absurdes.
  const availableTypes: DraftType[] = useMemo(() => {
    switch (mode) {
      case "NEW":
        return ["QUEST", "LESSON", "CHAPTER", "CHALLENGE"];
      case "COURSE_FILL":
        return ["CHAPTER", "LESSON", "QUEST"];
      case "ENRICH":
        return ["LESSON", "QUEST"];
      case "DAILY":
        return ["CHALLENGE"];
    }
  }, [mode]);

  // Si le type courant n'est plus valide pour le mode, fallback.
  if (!availableTypes.includes(type)) {
    setType(availableTypes[0]);
  }

  const needsCourse = mode === "COURSE_FILL" || mode === "ENRICH";
  const needsChapter = mode === "ENRICH" && type === "LESSON";

  const onGenerate = async () => {
    if (generating || subject.trim().length < 5) return;
    setGenerating(true);
    try {
      const csrf = readCookie("bq_csrf");
      const body = {
        mode,
        subject: subject.trim(),
        audience,
        objective: objective.trim() || undefined,
        concepts: concepts
          .split(",")
          .map((c) => c.trim())
          .filter((c) => c.length > 0),
        constraints: constraints.trim() || undefined,
        courseSlug: needsCourse ? courseSlug || undefined : undefined,
        chapterSlug: needsChapter ? chapterSlug || undefined : undefined,
        challengeFormat: type === "CHALLENGE" ? challengeFormat : undefined,
      };
      const res = await fetch(`/api/admin/ai/generate/${type.toLowerCase()}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        issues?: Array<{ message: string }>;
        draft?: { warnings?: Array<{ message: string }> };
      };
      if (!res.ok) {
        const detail = data.issues?.[0]?.message ?? data.error ?? `Erreur ${res.status}`;
        throw new Error(detail);
      }
      const warnings = data.draft?.warnings ?? [];
      toast({
        title: "Brouillon généré",
        description:
          warnings.length > 0
            ? `${warnings.length} warning(s) à vérifier.`
            : "Review-le ci-dessous, puis Approuve ou Rejette.",
        variant: warnings.length > 0 ? "destructive" : undefined,
      });
      setSubject("");
      setObjective("");
      setConcepts("");
      setConstraints("");
      startTransition(() => router.refresh());
    } catch (e) {
      toast({
        title: "Génération impossible",
        description: e instanceof Error ? e.message : "Erreur inconnue.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Générer un brouillon
        </CardTitle>
        <CardDescription>
          Décris ton idée. Claude analyse la taxonomie, respecte le workflow BitQuest, et
          produit un brouillon structuré que tu valides avant publication.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Mode de génération
          </Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(Object.keys(MODE_LABEL) as GenerationMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                disabled={generating || pending}
                className={`flex items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:opacity-60 ${
                  mode === m
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                <div className={`mt-0.5 h-3 w-3 rounded-full border-2 ${
                  mode === m ? "border-primary bg-primary" : "border-muted-foreground"
                }`} />
                <span>{MODE_LABEL[m]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Type + Audience */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="type" className="text-xs">Type</Label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as DraftType)}
              disabled={generating || pending}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {availableTypes.map((t) => (
                <option key={t} value={t}>{TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audience" className="text-xs">Public cible</Label>
            <select
              id="audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value as Audience)}
              disabled={generating || pending}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {(Object.keys(AUDIENCE_LABEL) as Audience[]).map((a) => (
                <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Course picker (COURSE_FILL / ENRICH) — SearchableSelect lazy + paginé */}
        {needsCourse && (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <div className="space-y-1.5">
              <Label htmlFor="course" className="text-xs">Cours ciblé</Label>
              <SearchableSelect
                id="course"
                type="course"
                value={courseSlug || null}
                valueField="slug"
                placeholder="Rechercher un cours par titre…"
                disabled={generating || pending}
                required
                selectedLabel={
                  courses.find((c) => c.slug === courseSlug)?.title ?? undefined
                }
                onChange={(item) => {
                  setCourseSlug(item?.slug ?? "");
                  setChapterSlug("");
                }}
              />
            </div>
            {courseSlug && (
              <div className="space-y-1.5">
                <Label htmlFor="chapter" className="text-xs">
                  {needsChapter ? "Chapitre cible (requis)" : "Chapitre cible (optionnel)"}
                </Label>
                <SearchableSelect
                  id="chapter"
                  type="chapter"
                  value={chapterSlug || null}
                  valueField="slug"
                  placeholder="Rechercher un chapitre dans ce cours…"
                  disabled={generating || pending}
                  required={needsChapter}
                  extraParams={{ courseSlug }}
                  onChange={(item) => setChapterSlug(item?.slug ?? "")}
                />
              </div>
            )}
          </div>
        )}

        {/* Challenge format */}
        {type === "CHALLENGE" && (
          <div className="space-y-1.5">
            <Label htmlFor="cformat" className="text-xs">Format du défi</Label>
            <select
              id="cformat"
              value={challengeFormat}
              onChange={(e) => setChallengeFormat(e.target.value as ChallengeFormat)}
              disabled={generating || pending}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="QUESTION">Question ouverte</option>
              <option value="QUIZ">Quiz / QCM</option>
              <option value="MINI_TASK">Mini-tâche</option>
              <option value="OBSERVATION">Observation mempool/explorer</option>
            </select>
          </div>
        )}

        {/* Subject — champ principal */}
        <div className="space-y-1.5">
          <Label htmlFor="subject" className="text-xs">
            Idée / sujet principal <span className="text-destructive">*</span>
          </Label>
          <textarea
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={generating || pending}
            maxLength={500}
            rows={2}
            placeholder={PLACEHOLDERS[type]}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            required
          />
        </div>

        {/* Toggle avancé */}
        <button
          type="button"
          onClick={() => setAdvanced(!advanced)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {advanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Détails avancés (objectif, notions, contraintes)
        </button>

        {advanced && (
          <div className="space-y-3 rounded-md border bg-muted/20 p-3">
            <div className="space-y-1.5">
              <Label htmlFor="objective" className="text-xs">Objectif pédagogique</Label>
              <Input
                id="objective"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                disabled={generating || pending}
                maxLength={300}
                placeholder="Ex: Comprendre comment une transaction consomme des UTXO"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="concepts" className="text-xs">Notions à aborder (séparées par virgule)</Label>
              <Input
                id="concepts"
                value={concepts}
                onChange={(e) => setConcepts(e.target.value)}
                disabled={generating || pending}
                placeholder="Ex: UTXO, mempool, fee rate, signatures"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="constraints" className="text-xs">Contraintes / instructions</Label>
              <textarea
                id="constraints"
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                disabled={generating || pending}
                maxLength={500}
                rows={2}
                placeholder="Ton, style, références à éviter…"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-muted-foreground">
            {mode === "COURSE_FILL" && !courseSlug && "⚠ Sélectionne un cours."}
            {mode === "ENRICH" && !courseSlug && "⚠ Sélectionne un cours."}
            {mode === "ENRICH" && type === "LESSON" && courseSlug && !chapterSlug && "⚠ Sélectionne un chapitre."}
          </div>
          <PendingButton
            type="button"
            pending={generating || pending}
            pendingLabel="Génération…"
            onClick={onGenerate}
            disabled={
              subject.trim().length < 5 ||
              (mode === "COURSE_FILL" && !courseSlug) ||
              (mode === "ENRICH" && (!courseSlug || (type === "LESSON" && !chapterSlug)))
            }
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Générer un {TYPE_LABEL[type]}
          </PendingButton>
        </div>
      </CardContent>
    </Card>
  );
}

const PLACEHOLDERS: Record<DraftType, string> = {
  QUEST: 'Ex: "Créer une quête pratique autour de la création d\'un portefeuille Bitcoin"',
  LESSON: 'Ex: "Expliquer le fonctionnement des transactions Bitcoin"',
  CHAPTER: 'Ex: "Créer un chapitre d\'introduction à la blockchain"',
  CHALLENGE: 'Ex: "Défi sur les différences entre Bitcoin et Ethereum"',
};

/* ========================================================================
 * Draft card + history row — réutilisé de la v1 avec léger enrichissement
 * ====================================================================== */
function DraftCard({ draft }: { draft: DraftRow }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const payload = useMemo(() => JSON.parse(draft.payload) as Record<string, unknown>, [draft.payload]);
  const title = String(payload.title ?? "(sans titre)");
  const subtitle = String(payload.subtitle ?? payload.summary ?? "");
  const slug = String(payload.code ?? payload.slug ?? payload.date ?? "");
  const warnings = draft.rejectReason?.split(" | ") ?? [];

  const onApprove = async () => {
    setBusy(true);
    try {
      const csrf = readCookie("bq_csrf");
      const res = await fetch(`/api/admin/ai/drafts/${draft.id}/approve`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      toast({ title: "Publié", description: "Visible dans l'admin correspondant." });
      startTransition(() => router.refresh());
    } catch (e) {
      toast({
        title: "Approbation impossible",
        description: e instanceof Error ? e.message : "Erreur inconnue.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const onReject = async () => {
    const reason = window.prompt("Raison du rejet (optionnel) :")?.trim() ?? "";
    setBusy(true);
    try {
      const csrf = readCookie("bq_csrf");
      const res = await fetch(`/api/admin/ai/drafts/${draft.id}/reject`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      toast({ title: "Brouillon rejeté" });
      startTransition(() => router.refresh());
    } catch (e) {
      toast({
        title: "Rejet impossible",
        description: e instanceof Error ? e.message : "Erreur inconnue.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="outline">{draft.type}</Badge>
          {slug && <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{slug}</code>}
        </div>
        {subtitle && <CardDescription>{subtitle}</CardDescription>}
        {warnings.length > 0 && warnings[0] && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            {warnings.map((w, i) => <div key={i}>{w}</div>)}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {editing ? (
          <DraftEditor
            draftId={draft.id}
            type={draft.type as "QUEST" | "LESSON" | "CHAPTER" | "CHALLENGE"}
            payload={payload}
            onCancel={() => setEditing(false)}
            onDone={() => {
              setEditing(false);
              startTransition(() => router.refresh());
            }}
          />
        ) : (
          <>
            <DraftPreview type={draft.type} payload={payload} />
            <details className="rounded-md border bg-muted/30 p-3">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Payload JSON complet
              </summary>
              <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap font-mono text-[11px]">
                {JSON.stringify(payload, null, 2)}
              </pre>
            </details>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span>{draft.aiModel}</span>
              {typeof draft.tokensOutput === "number" && (
                <span>· {draft.tokensOutput} tokens sortie</span>
              )}
              <span>· {new Date(draft.createdAt).toLocaleString("fr-FR")}</span>
            </div>
            <div className="flex items-center justify-between gap-2 pt-2">
              <PendingButton
                type="button"
                pending={busy || pending}
                pendingLabel="Rejet…"
                onClick={onReject}
                className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
              >
                <X className="h-3.5 w-3.5" /> Rejeter
              </PendingButton>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  disabled={busy || pending}
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-60"
                >
                  <Pencil className="h-3.5 w-3.5" /> Modifier
                </button>
                <PendingButton
                  type="button"
                  pending={busy || pending}
                  pendingLabel="Publication…"
                  onClick={onApprove}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  <Check className="h-3.5 w-3.5" /> Approuver
                </PendingButton>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Rendu lisible des champs structurés selon le type. */
function DraftPreview({ type, payload }: { type: string; payload: Record<string, unknown> }) {
  const asStrings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const asSections = (v: unknown): Array<{ heading: string }> =>
    Array.isArray(v)
      ? v.flatMap((x) =>
          typeof x === "object" && x !== null && typeof (x as { heading?: unknown }).heading === "string"
            ? [{ heading: (x as { heading: string }).heading }]
            : [],
        )
      : [];

  if (type === "LESSON") {
    const objectives = asStrings(payload.objectives);
    const sections = asSections(payload.sections);
    return (
      <div className="space-y-2 text-xs">
        {payload.intro ? <p className="italic text-muted-foreground">{String(payload.intro)}</p> : null}
        {objectives.length > 0 && (
          <div>
            <div className="font-semibold">Objectifs :</div>
            <ul className="list-disc pl-5">{objectives.map((o, i) => <li key={i}>{o}</li>)}</ul>
          </div>
        )}
        {sections.length > 0 && (
          <div>
            <div className="font-semibold">Sections :</div>
            <ol className="list-decimal pl-5">{sections.map((s, i) => <li key={i}>{s.heading}</li>)}</ol>
          </div>
        )}
      </div>
    );
  }
  if (type === "QUEST") {
    const steps = asStrings(payload.steps);
    const criteria = asStrings(payload.successCriteria);
    return (
      <div className="space-y-2 text-xs">
        {payload.scenario ? <p className="italic">{String(payload.scenario)}</p> : null}
        {payload.mission ? (
          <p><span className="font-semibold">Mission :</span> {String(payload.mission)}</p>
        ) : null}
        {steps.length > 0 && (
          <div>
            <div className="font-semibold">Étapes :</div>
            <ol className="list-decimal pl-5">{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </div>
        )}
        {criteria.length > 0 && (
          <div>
            <div className="font-semibold">Critères de réussite :</div>
            <ul className="list-disc pl-5">{criteria.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </div>
        )}
      </div>
    );
  }
  if (type === "CHAPTER") {
    const plan = asStrings(payload.lessonsPlan);
    return (
      <div className="space-y-2 text-xs">
        {payload.objective ? (
          <p><span className="font-semibold">Objectif :</span> {String(payload.objective)}</p>
        ) : null}
        {plan.length > 0 && (
          <div>
            <div className="font-semibold">Plan de leçons :</div>
            <ol className="list-decimal pl-5">{plan.map((l, i) => <li key={i}>{l}</li>)}</ol>
          </div>
        )}
      </div>
    );
  }
  if (type === "CHALLENGE") {
    return (
      <div className="space-y-1 text-xs">
        {payload.format ? <Badge variant="outline">{String(payload.format)}</Badge> : null}
        {payload.prompt ? <p>{String(payload.prompt)}</p> : null}
        {payload.expectedAnswer ? (
          <p className="text-muted-foreground">
            <span className="font-semibold">Attendu :</span> {String(payload.expectedAnswer)}
          </p>
        ) : null}
      </div>
    );
  }
  return null;
}

function HistoryRow({ draft }: { draft: DraftRow }) {
  const payload = JSON.parse(draft.payload) as Record<string, unknown>;
  const title = String(payload.title ?? "(sans titre)");
  const slug = String(payload.code ?? payload.slug ?? payload.date ?? "");
  const tone =
    draft.status === "APPROVED"
      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
      : "border-muted-foreground/30 text-muted-foreground";
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          <Badge variant="outline">{draft.type}</Badge>
          {slug && <code className="rounded bg-muted px-1.5 py-0.5">{slug}</code>}
        </div>
        {draft.rejectReason && (
          <p className="text-muted-foreground">{draft.rejectReason}</p>
        )}
      </div>
      <Badge variant="outline" className={tone}>
        {draft.status}
      </Badge>
    </div>
  );
}
