/**
 * Générateur IA v2 — workflow-aware, brief-driven.
 *
 * Contrat :
 *   - Entrée : `GenerationBrief` (sujet, audience, objective, concepts,
 *     contraintes, ciblage courseSlug/chapterSlug).
 *   - Sortie : `DraftPayload<T>` validé par Zod.
 *   - System prompt split en blocs stables (cached) : règles plateforme +
 *     taxonomie + arbre cours ciblé. Le brief utilisateur est volatile et
 *     placé en fin de messages.
 */
import { z } from "zod";
import type { Anthropic } from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { DEFAULT_GENERATION_MODEL, getAnthropicClient } from "./anthropic-client";
import {
  ChallengeDraftSchema,
  ChapterDraftSchema,
  DRAFT_SCHEMA_BY_TYPE,
  LessonDraftSchema,
  QuestDraftSchema,
  type ChallengeDraft,
  type ChapterDraft,
  type DraftType,
  type GenerationBrief,
  type LessonDraft,
  type QuestDraft,
} from "./schemas";
import { loadCourseTree, renderCourseTree } from "./course-context";

/* ============================================================
 * Taxonomy context (dédup)
 * ============================================================ */
export interface TaxonomyContext {
  QUEST: Array<{ code: string; track: string; order: number; title: string; missionType: string }>;
  LESSON: Array<{ chapterSlug: string; slug: string; title: string; order: number }>;
  CHAPTER: Array<{ courseSlug: string; slug: string; title: string; order: number }>;
  CHALLENGE: Array<{ date: string; title: string }>;
}

/* ============================================================
 * SYSTEM PROMPTS — plateforme awareness
 * ============================================================ */
const PLATFORM_RULES = `Tu es rédacteur pédagogique intégré à BitQuest, plateforme open-source d'apprentissage Bitcoin par la pratique.

## Mission plateforme
BitQuest enseigne Bitcoin et Lightning via : cours (groupes de chapitres) → chapitres (groupes de leçons) → leçons (contenu MDX) + quêtes (missions pratiques dans BitLab) + défis quotidiens (micro-exercices).

## Règles métier INVIOLABLES
- **Progression pédagogique** : INITIATION < INTERMEDIATE < ADVANCED. Ne jamais placer un contenu ADVANCED avant qu'un concept INITIATION l'introduise.
- **Récompenses calibrées par track** :
  - INITIATION : 20-80 XP, 10-50 sats.
  - INTERMEDIATE : 80-200 XP, 50-150 sats.
  - ADVANCED : 200-400 XP, 150-500 sats.
  - SPECIAL : 100-500 XP, 0-2000 sats.
- **Gamification** : tous les sats sont simulés. NE JAMAIS promettre de vrais sats, mainnet, ou retrait.
- **Mission BitLab** : 8 types seulement (block_explorer, key_forge, tx_builder, mine_nonce, ln_channel, ln_invoice, multisig_sign, taproot_tweak).
- **Taxonomie unique** : chaque code/slug/date doit être unique dans sa table.
- **Langue** : français clair, termes techniques Bitcoin en anglais (UTXO, mempool, hash, bolt11, scid).
- **Qualité** : pas de concepts inventés, pas de références non vérifiables, pas de contenu controversé (politique, trading, forks militants).

## Workflow par type
- **LESSON** : rattachée à un chapitre existant. Structure complète = intro → objectifs → sections explicatives (chacune avec exemple optionnel) → keypoints → conclusion → questions optionnelles.
- **CHAPTER** : rattaché à un cours existant. Doit proposer un plan de 2-8 leçons cohérentes dans \`lessonsPlan\`.
- **QUEST** : scénario motivant + mission BitLab concrète + objectifs + étapes + critères de réussite + récompenses calibrées.
- **CHALLENGE** : micro-exercice quotidien, format (QUESTION|QUIZ|MINI_TASK|OBSERVATION), date future unique.

## Vérifications avant de produire
1. Les prérequis sont-ils satisfaits ? (existence du cours cible, slug chapitre valide)
2. L'ordre proposé évite-t-il les conflits avec l'existant ?
3. La difficulté correspond-elle au public cible ?
4. Chaque champ obligatoire est-il présent et non-trivial ?`;

const EXTRA_PROMPTS_BY_TYPE: Record<DraftType, string> = {
  QUEST: `## Spécifique QUEST
- \`scenario\` ≠ \`intro\` : scenario = narratif court (2-3 phrases), intro = pédagogique (contexte + concept).
- \`mission\` = action BitLab concrète en 1-2 phrases.
- \`steps\` = étapes ordonnées de l'apprenant dans BitLab.
- \`successCriteria\` = vérifications testables (par défaut l'apprenant les lit, pas de parsing automatique).
- Choisir \`missionType\` cohérent avec le concept (ex : UTXO → tx_builder, blocs → mine_nonce, factures → ln_invoice).`,

  LESSON: `## Spécifique LESSON
- \`chapterSlug\` doit matcher un chapitre existant du contexte (regarde la taxonomie/arbre cours).
- \`sections\` : 2-6 sections, chaque section = concept → explication → (optionnel) exemple concret. Pas de pavés monolithiques.
- \`comprehensionQuestions\` optionnelles mais recommandées pour les leçons >5 min.
- \`estimatedMinutes\` = temps de lecture honnête, pas d'exagération.`,

  CHAPTER: `## Spécifique CHAPTER
- \`courseSlug\` doit matcher un cours existant.
- \`lessonsPlan\` = titres des leçons à créer dans l'ordre (2-8). Les leçons elles-mêmes seront générées ensuite via type=LESSON.
- \`objective\` = ce que l'apprenant saura faire à la fin du chapitre.`,

  CHALLENGE: `## Spécifique CHALLENGE
- Format compact : l'apprenant doit finir en <5 min.
- \`format\` guide le rendu : QUESTION (texte libre), QUIZ (choix), MINI_TASK (observation guidée), OBSERVATION (regarder mempool/explorer).
- \`expectedAnswer\` sert à la review admin — ne JAMAIS l'exposer côté apprenant.
- \`date\` = future, non déjà prise.`,
};

/* ============================================================
 * Core
 * ============================================================ */
export type DraftPayload<T extends DraftType> = T extends "QUEST"
  ? QuestDraft
  : T extends "LESSON"
    ? LessonDraft
    : T extends "CHAPTER"
      ? ChapterDraft
      : T extends "CHALLENGE"
        ? ChallengeDraft
        : never;

export interface GenerateResult<T extends DraftType> {
  draft: DraftPayload<T>;
  model: string;
  usage: {
    input: number;
    output: number;
    cacheRead: number;
    cacheCreated: number;
  };
}

export interface GenerateInput<T extends DraftType> {
  type: T;
  brief: GenerationBrief;
  taxonomy: TaxonomyContext[T];
}

export async function generateDraft<T extends DraftType>(
  input: GenerateInput<T>,
): Promise<GenerateResult<T>> {
  const client = getAnthropicClient();
  const { type, brief, taxonomy } = input;

  // Charge arbre cours si ciblé (modes COURSE_FILL / ENRICH).
  let courseContext: string | null = null;
  if (brief.courseSlug) {
    const tree = await loadCourseTree(brief.courseSlug);
    if (tree) courseContext = renderCourseTree(tree);
    else throw new Error(`Cours introuvable : ${brief.courseSlug}`);
  }

  const taxonomyBlock = renderTaxonomy(type, taxonomy);
  const userBlock = renderBrief(brief);
  const schema = DRAFT_SCHEMA_BY_TYPE[type];

  // System = règles plateforme (cached) + extras type-specific + taxonomy + cours (cached).
  const systemBlocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: PLATFORM_RULES },
    { type: "text", text: EXTRA_PROMPTS_BY_TYPE[type] },
    {
      type: "text",
      text: `## Taxonomie actuelle (${type})\n\n${taxonomyBlock}`,
      cache_control: { type: "ephemeral" },
    },
  ];
  if (courseContext) {
    systemBlocks.push({
      type: "text",
      text: courseContext,
      cache_control: { type: "ephemeral" },
    });
  }

  const response = await client.messages.parse({
    model: DEFAULT_GENERATION_MODEL,
    max_tokens: 6144,
    thinking: { type: "adaptive" },
    system: systemBlocks,
    messages: [{ role: "user", content: userBlock }],
    output_config: {
      format: zodOutputFormat(schema as unknown as z.ZodType<DraftPayload<T>>),
    },
  } as Anthropic.MessageCreateParamsNonStreaming);

  if (!response.parsed_output) {
    throw new Error("Claude n'a pas retourné de JSON conforme au schéma demandé.");
  }

  enforceNoDuplicate(type, taxonomy, response.parsed_output as DraftPayload<T>);

  return {
    draft: response.parsed_output as DraftPayload<T>,
    model: DEFAULT_GENERATION_MODEL,
    usage: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
      cacheRead: response.usage.cache_read_input_tokens ?? 0,
      cacheCreated: response.usage.cache_creation_input_tokens ?? 0,
    },
  };
}

/* ============================================================
 * Rendering helpers
 * ============================================================ */
function renderBrief(b: GenerationBrief): string {
  const lines: string[] = [];
  lines.push(`# Brief de génération`);
  lines.push(`Type demandé : **${b.type}**  ·  Mode : **${b.mode}**  ·  Public : **${b.audience}**`);
  lines.push("");
  lines.push(`## Idée principale`);
  lines.push(b.subject);
  if (b.objective) {
    lines.push("");
    lines.push(`## Objectif pédagogique`);
    lines.push(b.objective);
  }
  if (b.concepts.length > 0) {
    lines.push("");
    lines.push(`## Notions à aborder`);
    for (const c of b.concepts) lines.push(`- ${c}`);
  }
  if (b.constraints) {
    lines.push("");
    lines.push(`## Contraintes / instructions complémentaires`);
    lines.push(b.constraints);
  }
  if (b.type === "LESSON" && b.chapterSlug) {
    lines.push("");
    lines.push(`## Chapitre cible : ${b.chapterSlug}`);
    lines.push(`→ le \`chapterSlug\` de ta leçon DOIT être exactement \`${b.chapterSlug}\`.`);
  }
  if (b.type === "CHAPTER" && b.courseSlug) {
    lines.push("");
    lines.push(`→ le \`courseSlug\` de ton chapitre DOIT être exactement \`${b.courseSlug}\`.`);
  }
  if (b.type === "CHALLENGE" && b.challengeFormat) {
    lines.push("");
    lines.push(`→ \`format\` demandé : ${b.challengeFormat}.`);
  }
  lines.push("");
  lines.push(`Génère maintenant un **${b.type}** respectant toutes les règles plateforme et évitant les doublons avec la taxonomie fournie.`);
  return lines.join("\n");
}

function renderTaxonomy<T extends DraftType>(type: T, ctx: TaxonomyContext[T]): string {
  if (ctx.length === 0) return "(aucun contenu existant — champ libre)";
  switch (type) {
    case "QUEST": {
      const items = ctx as TaxonomyContext["QUEST"];
      const sorted = [...items].sort(
        (a, b) => a.track.localeCompare(b.track) || a.order - b.order || a.code.localeCompare(b.code),
      );
      return [
        "| track | order | code | title | missionType |",
        "|---|---|---|---|---|",
        ...sorted.map((q) => `| ${q.track} | ${q.order} | ${q.code} | ${q.title} | ${q.missionType} |`),
      ].join("\n");
    }
    case "LESSON": {
      const items = ctx as TaxonomyContext["LESSON"];
      const sorted = [...items].sort(
        (a, b) => a.chapterSlug.localeCompare(b.chapterSlug) || a.order - b.order,
      );
      return [
        "| chapterSlug | order | slug | title |",
        "|---|---|---|---|",
        ...sorted.map((l) => `| ${l.chapterSlug} | ${l.order} | ${l.slug} | ${l.title} |`),
      ].join("\n");
    }
    case "CHAPTER": {
      const items = ctx as TaxonomyContext["CHAPTER"];
      const sorted = [...items].sort(
        (a, b) => a.courseSlug.localeCompare(b.courseSlug) || a.order - b.order,
      );
      return [
        "| courseSlug | order | slug | title |",
        "|---|---|---|---|",
        ...sorted.map((c) => `| ${c.courseSlug} | ${c.order} | ${c.slug} | ${c.title} |`),
      ].join("\n");
    }
    case "CHALLENGE": {
      const items = ctx as TaxonomyContext["CHALLENGE"];
      const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
      return [
        "| date | title |",
        "|---|---|",
        ...sorted.map((c) => `| ${c.date} | ${c.title} |`),
      ].join("\n");
    }
  }
  return "";
}

function enforceNoDuplicate<T extends DraftType>(
  type: T,
  taxonomy: TaxonomyContext[T],
  draft: DraftPayload<T>,
): void {
  switch (type) {
    case "QUEST": {
      const codes = new Set((taxonomy as TaxonomyContext["QUEST"]).map((q) => q.code));
      const d = draft as QuestDraft;
      if (codes.has(d.code)) throw new Error(`Code quête déjà pris : ${d.code}.`);
      break;
    }
    case "LESSON": {
      const keys = new Set(
        (taxonomy as TaxonomyContext["LESSON"]).map((l) => `${l.chapterSlug}/${l.slug}`),
      );
      const d = draft as LessonDraft;
      if (keys.has(`${d.chapterSlug}/${d.slug}`))
        throw new Error(`Leçon déjà existante : ${d.chapterSlug}/${d.slug}.`);
      break;
    }
    case "CHAPTER": {
      const keys = new Set(
        (taxonomy as TaxonomyContext["CHAPTER"]).map((c) => `${c.courseSlug}/${c.slug}`),
      );
      const d = draft as ChapterDraft;
      if (keys.has(`${d.courseSlug}/${d.slug}`))
        throw new Error(`Chapitre déjà existant : ${d.courseSlug}/${d.slug}.`);
      break;
    }
    case "CHALLENGE": {
      const dates = new Set((taxonomy as TaxonomyContext["CHALLENGE"]).map((c) => c.date));
      const d = draft as ChallengeDraft;
      if (dates.has(d.date)) throw new Error(`Défi déjà prévu le ${d.date}.`);
      break;
    }
  }
}
