/**
 * Générateur polymorphe pour les 4 types de contenu : QUEST, LESSON, CHAPTER,
 * CHALLENGE.
 *
 * Contrat unique :
 *   - `generateDraft({ type, context, hint })` → `{ draft, model, usage }`
 *   - `context` est la taxonomie courante (objet typé par le `type`)
 *   - Le system prompt commun + la taxonomie sont marqués `cache_control`
 *     ephemeral → amortis sur plusieurs générations successives du même type.
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
  type LessonDraft,
  type QuestDraft,
} from "./schemas";

const COMMON_SYSTEM = `Tu es rédacteur pédagogique pour BitQuest, plateforme open-source qui enseigne Bitcoin par la pratique.

Règles communes à tous les contenus :
- Français clair, direct, sans anglicismes gratuits. Termes techniques (UTXO, mempool, hash, bolt11, scid) en anglais, le reste en français.
- Pas de contenu controversé (politique, trading, forks militants).
- Pas de promesse de récompense en vrais sats ou mainnet — tout est simulé.
- Pas de concept Bitcoin inventé ou approximatif.
- Ne jamais réutiliser un slug / code existant déjà dans la taxonomie.`;

const SYSTEM_BY_TYPE: Record<DraftType, string> = {
  QUEST: `${COMMON_SYSTEM}

Pour une QUÊTE :
- Pose UN concept Bitcoin précis (UTXO, mempool, fees, Lightning, multisig, taproot…).
- Doit être jouable (mission BitLab concrète), pas juste théorique.
- Titre court et évocateur (pas de "Comment …" ni "Introduction à …").
- Récompenses calibrées : INITIATION 20-80 XP / 10-50 sats, INTERMEDIATE 80-200/50-150, ADVANCED 200-400/150-500.`,

  LESSON: `${COMMON_SYSTEM}

Pour une LEÇON :
- Markdown pur (titres h2/h3, listes, blocs de code \`\`\`).
- 300 à 2500 caractères utiles. Pas de pavés.
- Doit s'intégrer à un chapitre existant (champ chapterSlug). Si plusieurs chapitres plausibles, choisis celui qui minimise le chevauchement avec les leçons déjà présentes.
- estimatedMinutes = temps de lecture honnête (2-15 min typique, 30 max).`,

  CHAPTER: `${COMMON_SYSTEM}

Pour un CHAPITRE :
- Regroupe 3-5 leçons autour d'un thème unique. Le chapitre lui-même n'a PAS de contenu, juste titre + résumé.
- courseSlug = cours parent (doit exister dans la taxonomie).
- Ordre : à incrémenter par rapport aux chapitres existants du même cours.`,

  CHALLENGE: `${COMMON_SYSTEM}

Pour un DÉFI QUOTIDIEN :
- Format : 1 question / 1 énigme / 1 observation. L'apprenant répond en <5 min.
- prompt = la consigne complète (peut inclure un exemple ou un lien mental vers une quête existante).
- date = jour cible au format YYYY-MM-DD (pas déjà utilisée dans la taxonomie).
- Récompenses modestes : xpReward 5-50, satsReward 0-30.`,
};

/** Résumés utilisés comme contexte pédagogique côté prompt. */
export interface GenerationContext {
  QUEST: Array<{ code: string; track: string; order: number; title: string; missionType: string }>;
  LESSON: Array<{ chapterSlug: string; slug: string; title: string; order: number }>;
  CHAPTER: Array<{ courseSlug: string; slug: string; title: string; order: number }>;
  CHALLENGE: Array<{ date: string; title: string }>;
}

export interface GenerateDraftInput<T extends DraftType = DraftType> {
  type: T;
  context: GenerationContext[T];
  hint?: string;
}

export type DraftPayload<T extends DraftType> = T extends "QUEST"
  ? QuestDraft
  : T extends "LESSON"
    ? LessonDraft
    : T extends "CHAPTER"
      ? ChapterDraft
      : T extends "CHALLENGE"
        ? ChallengeDraft
        : never;

export interface GenerateDraftResult<T extends DraftType> {
  draft: DraftPayload<T>;
  model: string;
  usage: {
    input: number;
    output: number;
    cacheRead: number;
    cacheCreated: number;
  };
}

export async function generateDraft<T extends DraftType>(
  input: GenerateDraftInput<T>,
): Promise<GenerateDraftResult<T>> {
  const client = getAnthropicClient();
  const taxonomy = renderTaxonomy(input.type, input.context);
  const userBlock = input.hint
    ? `Génère un nouveau ${input.type} cohérent avec la taxonomie ci-dessus.\n\nFocus demandé : ${input.hint.trim()}`
    : `Génère un nouveau ${input.type} cohérent avec la taxonomie ci-dessus. Choisis un angle qui complète l'existant sans doublon.`;

  // Le SDK TS exporte zodOutputFormat qui accepte un ZodType, on peut donc passer
  // le schema correspondant au type demandé via le map. `parse()` fera le validate.
  const schema = DRAFT_SCHEMA_BY_TYPE[input.type];

  const response = await client.messages.parse({
    model: DEFAULT_GENERATION_MODEL,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: [
      { type: "text", text: SYSTEM_BY_TYPE[input.type] },
      {
        type: "text",
        text: `Taxonomie actuelle (${input.type}) :\n\n${taxonomy}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userBlock }],
    output_config: {
      format: zodOutputFormat(schema as unknown as z.ZodType<DraftPayload<T>>),
    },
  } as Anthropic.MessageCreateParamsNonStreaming);

  if (!response.parsed_output) {
    throw new Error("Claude n'a pas retourné de JSON conforme au schéma demandé.");
  }

  enforceNoDuplicate(input.type, input.context, response.parsed_output as DraftPayload<T>);

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

/* ------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------ */
function renderTaxonomy<T extends DraftType>(type: T, ctx: GenerationContext[T]): string {
  if (ctx.length === 0) return "(aucun contenu existant — champ libre)";
  switch (type) {
    case "QUEST": {
      const items = ctx as GenerationContext["QUEST"];
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
      const items = ctx as GenerationContext["LESSON"];
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
      const items = ctx as GenerationContext["CHAPTER"];
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
      const items = ctx as GenerationContext["CHALLENGE"];
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
  ctx: GenerationContext[T],
  draft: DraftPayload<T>,
): void {
  switch (type) {
    case "QUEST": {
      const codes = new Set((ctx as GenerationContext["QUEST"]).map((q) => q.code));
      const d = draft as QuestDraft;
      if (codes.has(d.code)) throw new Error(`Code quête déjà pris : ${d.code}. Relance.`);
      break;
    }
    case "LESSON": {
      const keys = new Set(
        (ctx as GenerationContext["LESSON"]).map((l) => `${l.chapterSlug}/${l.slug}`),
      );
      const d = draft as LessonDraft;
      if (keys.has(`${d.chapterSlug}/${d.slug}`))
        throw new Error(`Leçon déjà existante : ${d.chapterSlug}/${d.slug}. Relance.`);
      break;
    }
    case "CHAPTER": {
      const keys = new Set(
        (ctx as GenerationContext["CHAPTER"]).map((c) => `${c.courseSlug}/${c.slug}`),
      );
      const d = draft as ChapterDraft;
      if (keys.has(`${d.courseSlug}/${d.slug}`))
        throw new Error(`Chapitre déjà existant : ${d.courseSlug}/${d.slug}. Relance.`);
      break;
    }
    case "CHALLENGE": {
      const dates = new Set((ctx as GenerationContext["CHALLENGE"]).map((c) => c.date));
      const d = draft as ChallengeDraft;
      if (dates.has(d.date)) throw new Error(`Défi déjà prévu le ${d.date}. Relance.`);
      break;
    }
  }
}
