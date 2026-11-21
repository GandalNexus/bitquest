#!/usr/bin/env node
/**
 * CLI : valide l'environnement courant et sort avec code 0 (OK) ou 1 (critique).
 *
 * Usage :
 *   NODE_ENV=production npx tsx scripts/validate-env.ts
 *   npm run validate:env
 */
import { validateEnv, currentEnv, type EnvIssue } from "../src/lib/config/env-validator";

function fmt(issue: EnvIssue): string {
  const prefix =
    issue.severity === "critical" ? "✗ CRIT" : issue.severity === "warning" ? "⚠ WARN" : "ℹ INFO";
  return `${prefix}  ${issue.key.padEnd(32)}  ${issue.message}`;
}

function main(): void {
  const env = currentEnv();
  const issues = validateEnv();
  // eslint-disable-next-line no-console
  console.log(`env-validator — environment=${env}`);
  if (issues.length === 0) {
    // eslint-disable-next-line no-console
    console.log("✓ Aucune anomalie détectée.");
    process.exit(0);
  }
  // eslint-disable-next-line no-console
  for (const i of issues) console.log(fmt(i));
  const critical = issues.filter((i) => i.severity === "critical").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  // eslint-disable-next-line no-console
  console.log(`\nSummary: ${critical} critical, ${warnings} warning(s).`);
  process.exit(critical > 0 ? 1 : 0);
}

main();
