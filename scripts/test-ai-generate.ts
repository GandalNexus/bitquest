/**
 * Smoke test du pipeline de génération IA v2.
 * Usage : docker exec -e ANTHROPIC_API_KEY=... -e AI_GENERATION_ENABLED=1 bitquest-dev \
 *          sh -c 'cd /app && npx tsx scripts/test-ai-generate.ts'
 */
import { generateDraft } from "../src/lib/ai/generate";
import { loadTaxonomy } from "../src/lib/ai/context";
import { checkConformity } from "../src/lib/ai/validate";
import { db } from "../src/lib/db";
import { GenerationBriefSchema } from "../src/lib/ai/schemas";

async function main() {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    console.error("❌ ANTHROPIC_API_KEY absent.");
    process.exit(1);
  }

  console.log("⚡ Génération d'un brouillon QUEST guidé…");

  const brief = GenerationBriefSchema.parse({
    type: "QUEST",
    mode: "NEW",
    subject: "Comprendre les fees Bitcoin et la priorisation dans la mempool",
    audience: "BEGINNER",
    objective: "L'apprenant doit savoir estimer un fee rate adapté à son urgence",
    concepts: ["fee rate", "mempool", "sat/vB", "priorisation"],
  });

  const taxonomy = await loadTaxonomy("QUEST");
  console.log(`   Contexte : ${taxonomy.length} quêtes existantes.`);

  const start = Date.now();
  const result = await generateDraft({ type: "QUEST", brief, taxonomy });
  const ms = Date.now() - start;

  console.log(`\n✅ Généré en ${ms}ms (modèle ${result.model})`);
  console.log(`   Tokens : in=${result.usage.input} out=${result.usage.output} cacheRead=${result.usage.cacheRead}`);
  console.log(`\n📄 Draft :`);
  console.log(JSON.stringify(result.draft, null, 2));

  const issues = checkConformity("QUEST", result.draft);
  if (issues.length > 0) {
    console.log(`\n⚠ Conformity : ${issues.length} issue(s)`);
    for (const i of issues) console.log(`   [${i.severity}] ${i.code} — ${i.message}`);
  }

  const draft = await db.aIDraft.create({
    data: {
      type: "QUEST",
      payload: JSON.stringify(result.draft),
      aiModel: result.model,
      tokensInput: result.usage.input + result.usage.cacheRead + result.usage.cacheCreated,
      tokensOutput: result.usage.output,
    },
  });
  console.log(`\n💾 AIDraft id=${draft.id} → http://localhost:3000/admin/ai-review`);
  await db.$disconnect();
}

main().catch((err) => {
  console.error("❌ Échec :", err instanceof Error ? err.message : err);
  process.exit(1);
});
