/**
 * Script idempotent utilisé par la CI pour créer les comptes de test
 * (editor-test, learner-test) après le seed. Pas d'équivalent interactif
 * dans le seed principal — ces comptes sont spécifiques aux tests E2E.
 *
 * NB: fichier .js volontairement en CommonJS pour tourner avec `node`
 * sans build intermédiaire.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const db = new PrismaClient();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

async function upsertTestUser({ email, pseudo, role, password }) {
  const passwordHash = hashPassword(password);
  const token = crypto.randomBytes(24).toString("hex");
  await db.user.upsert({
    where: { email },
    update: { role, passwordHash, token },
    create: {
      pseudo,
      email,
      passwordHash,
      role,
      token,
      lastActiveDate: new Date().toISOString().slice(0, 10),
    },
  });
  console.log(`✓ ${pseudo} (${role})`);
}

(async () => {
  await upsertTestUser({
    email: "editor@bitquest.local",
    pseudo: "editor-test",
    role: "EDITOR",
    password: "Editor2026!",
  });
  await upsertTestUser({
    email: "learner@bitquest.local",
    pseudo: "learner-test",
    role: "APPRENTICE",
    password: "Learner2026!",
  });
  await db.$disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
