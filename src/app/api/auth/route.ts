import { db } from "@/lib/db";
import { publicUser } from "@/lib/bitquest/progression";
import { rateLimit } from "@/lib/bitquest/session";
import crypto from "crypto";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 32).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(check, "hex"));
}

const GUEST_NAMES = ["Satoshi Jr", "BlockRunner", "SatHunter", "MemExplorer", "NodeRider", "HodlerX", "BitRookie", "ChainWalker"];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body.action as string;

    if (action === "register") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const pseudo = String(body.pseudo ?? "").trim();
      const password = String(body.password ?? "");
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        return Response.json({ error: "Adresse email invalide." }, { status: 400 });
      }
      if (!pseudo || pseudo.length < 3 || pseudo.length > 20) {
        return Response.json({ error: "Le pseudo doit contenir entre 3 et 20 caractères." }, { status: 400 });
      }
      if (password.length < 6) {
        return Response.json({ error: "Le mot de passe doit contenir au moins 6 caractères." }, { status: 400 });
      }
      const existingEmail = await db.user.findUnique({ where: { email } });
      if (existingEmail) {
        return Response.json({ error: "Cet email est déjà utilisé." }, { status: 409 });
      }
      const existingPseudo = await db.user.findUnique({ where: { pseudo } });
      if (existingPseudo) {
        return Response.json({ error: "Ce pseudo est déjà pris." }, { status: 409 });
      }
      const user = await db.user.create({
        data: {
          email,
          pseudo,
          passwordHash: hashPassword(password),
          token: crypto.randomBytes(24).toString("hex"),
          lastActiveDate: new Date().toISOString().slice(0, 10),
        },
      });
      return Response.json({ user: publicUser(user), token: user.token });
    }

    if (action === "login") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const user = await db.user.findUnique({ where: { email } });
      if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
        return Response.json({ error: "Email ou mot de passe incorrect." }, { status: 401 });
      }
      const token = crypto.randomBytes(24).toString("hex");
      await db.user.update({ where: { id: user.id }, data: { token } });
      return Response.json({ user: publicUser(user), token });
    }

    if (action === "guest") {
      if (!rateLimit("guest:" + (req.headers.get("x-forwarded-for") ?? "local"), 10, 60_000)) {
        return Response.json({ error: "Trop de tentatives, réessaie dans une minute." }, { status: 429 });
      }
      const base = GUEST_NAMES[Math.floor(Math.random() * GUEST_NAMES.length)];
      let pseudo = base + "-" + crypto.randomBytes(2).toString("hex");
      while (await db.user.findUnique({ where: { pseudo } })) {
        pseudo = base + "-" + crypto.randomBytes(2).toString("hex");
      }
      const user = await db.user.create({
        data: {
          pseudo,
          isGuest: true,
          token: crypto.randomBytes(24).toString("hex"),
          lastActiveDate: new Date().toISOString().slice(0, 10),
        },
      });
      return Response.json({ user: publicUser(user), token: user.token });
    }

    return Response.json({ error: "Action inconnue." }, { status: 400 });
  } catch (e) {
    console.error("auth error", e);
    return Response.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
