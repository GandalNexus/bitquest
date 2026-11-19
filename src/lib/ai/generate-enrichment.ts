/**
 * Enrichissement d'une quête existante : génère theorySections + quizQuestions
 * à partir du contexte (code, title, intro, missionType, track).
 *
 * Distinct des 4 generators "DRAFT" car il modifie une ressource existante
 * plutôt que d'en créer une nouvelle. Sauvegardé dans `AIDraft` type
 * `QUEST_ENRICHMENT` → preview/review/approve avant application.
 */
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { DEFAULT_GENERATION_MODEL, getAnthropicClient } from "./anthropic-client";

export const QuestEnrichmentSchema = z.object({
  theorySections: z
    .array(
      z.object({
        title: z.string().min(2).max(120),
        body: z.string().min(50).max(3000),
        keypoints: z.array(z.string().min(2).max(200)).min(0).max(6),
      }),
    )
    .min(2)
    .max(5),
  quizQuestions: z
    .array(
      z.object({
        type: z.enum(["MCQ", "TRUE_FALSE"]),
        question: z.string().min(10).max(300),
        options: z.array(z.string().min(1).max(160)).max(6),
        correctIndex: z.number().int().min(0).max(5).optional(),
        correctBool: z.boolean().optional(),
        explanation: z.string().min(20).max(500),
      }),
    )
    .min(3)
    .max(6),
});

export type QuestEnrichment = z.infer<typeof QuestEnrichmentSchema>;

export interface EnrichmentInput {
  quest: {
    code: string;
    track: string;
    title: string;
    subtitle: string;
    description: string;
    intro: string;
    missionType: string;
  };
}

export interface EnrichmentResult {
  payload: QuestEnrichment;
  model: string;
  usage: {
    input: number;
    output: number;
    cacheRead: number;
    cacheCreated: number;
  };
}

const SYSTEM_PROMPT = `Tu es rédacteur pédagogique BitQuest. Tu reçois une quête (titre, intro, type de mission) et tu produis :
1. 2-5 **sections de théorie** (title + body + keypoints). Markdown léger autorisé.
2. 3-6 **questions de quiz** mélangeant MCQ (2-4 options) et TRUE_FALSE.

Règles :
- Les sections théoriques doivent s'enchaîner logiquement : concept → détail → exemple.
- Les questions quiz doivent tester la compréhension des sections, pas des devinettes.
- MCQ : fournir \`options\` (array) + \`correctIndex\` (number). Pas de \`correctBool\`.
- TRUE_FALSE : fournir \`correctBool\` (boolean). Laisser \`options\` vide []. Pas de \`correctIndex\`.
- \`explanation\` justifie la bonne réponse en 1-2 phrases.
- Français clair, termes techniques Bitcoin en anglais (UTXO, mempool, hash…).
- Pas de doublons avec l'intro déjà fournie.`;

export async function generateQuestEnrichment(input: EnrichmentInput): Promise<EnrichmentResult> {
  const client = getAnthropicClient();

  const context = `Quête à enrichir :
- Code : ${input.quest.code}
- Track : ${input.quest.track}
- Titre : ${input.quest.title}
- Sous-titre : ${input.quest.subtitle}
- Description : ${input.quest.description}
- Mission BitLab : ${input.quest.missionType}

Introduction pédagogique déjà rédigée (ne PAS répéter — complète-la) :

---
${input.quest.intro}
---`;

  const response = await client.messages.parse({
    model: DEFAULT_GENERATION_MODEL,
    max_tokens: 6144,
    thinking: { type: "adaptive" },
    system: [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: context }],
    output_config: {
      format: zodOutputFormat(QuestEnrichmentSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Claude n'a pas retourné d'enrichissement conforme.");
  }

  // Validation croisée : MCQ doit avoir correctIndex valide, TRUE_FALSE un correctBool.
  for (const q of response.parsed_output.quizQuestions) {
    if (q.type === "MCQ") {
      if (q.options.length < 2) throw new Error("MCQ : au moins 2 options requises.");
      if (q.correctIndex === undefined || q.correctIndex >= q.options.length) {
        throw new Error("MCQ : correctIndex absent ou hors bornes.");
      }
    } else {
      if (q.correctBool === undefined) {
        throw new Error("TRUE_FALSE : correctBool requis.");
      }
    }
  }

  return {
    payload: response.parsed_output,
    model: DEFAULT_GENERATION_MODEL,
    usage: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
      cacheRead: response.usage.cache_read_input_tokens ?? 0,
      cacheCreated: response.usage.cache_creation_input_tokens ?? 0,
    },
  };
}
