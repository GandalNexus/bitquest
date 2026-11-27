import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";

/**
 * POST /api/admin/uploads/image — ADMIN + CSRF.
 *
 * Multipart form-data field `file`. Accepte PNG / JPEG / WebP / GIF
 * statique jusqu'à 2 MB. Pas de SVG (vecteur XSS via onload /
 * foreignObject). Pas de redimensionnement — c'est à l'admin
 * d'uploader une image raisonnable (logo partenaire ~512×512 max).
 *
 * Le fichier est nommé `<sha256>.<ext>` → dédup automatique : uploader
 * la même image deux fois ne crée pas de doublon, retourne la même URL.
 * Servi en public via `/uploads/<name>` (dossier `public/uploads/`
 * monté comme static root de Next.js).
 *
 * En prod, monter un volume dédié sur `public/uploads/` dans le compose
 * pour que les uploads survivent aux rebuilds d'image. Documenté dans
 * `docs/POSTGRES_PROD_HARDENING.md`.
 */

export const runtime = "nodejs"; // fs API — pas edge-compatible

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Magic bytes par mime. On ne fait PAS confiance au Content-Type du
 * client — on vérifie les premiers octets du buffer.
 */
const MAGIC: Record<string, { bytes: number[]; ext: string }> = {
  "image/png": { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], ext: "png" },
  "image/jpeg": { bytes: [0xff, 0xd8, 0xff], ext: "jpg" },
  "image/webp": { bytes: [0x52, 0x49, 0x46, 0x46], ext: "webp" }, // RIFF — vérif additionnelle ci-dessous
  "image/gif": { bytes: [0x47, 0x49, 0x46, 0x38], ext: "gif" },
};

function detectMime(buf: Uint8Array): { mime: string; ext: string } | null {
  for (const [mime, { bytes, ext }] of Object.entries(MAGIC)) {
    if (buf.length < bytes.length) continue;
    let match = true;
    for (let i = 0; i < bytes.length; i++) {
      if (buf[i] !== bytes[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      // WebP : "RIFF" en head + "WEBP" aux bytes 8-11
      if (mime === "image/webp") {
        if (
          buf.length < 12 ||
          buf[8] !== 0x57 ||
          buf[9] !== 0x45 ||
          buf[10] !== 0x42 ||
          buf[11] !== 0x50
        ) {
          continue;
        }
      }
      return { mime, ext };
    }
  }
  return null;
}

export async function POST(req: Request) {
  const guard = await requireRoleAndCsrf(req, "ADMIN");
  if (!guard.ok) return guard.response;

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return Response.json(
      { error: "Content-Type attendu : multipart/form-data." },
      { status: 415 },
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return Response.json({ error: "Multipart illisible." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Champ `file` requis." }, { status: 400 });
  }

  if (file.size === 0) {
    return Response.json({ error: "Fichier vide." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: `Fichier trop lourd : ${file.size} octets, max ${MAX_BYTES}.` },
      { status: 413 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectMime(bytes);
  if (!detected) {
    return Response.json(
      {
        error:
          "Format non supporté : PNG, JPEG, WebP ou GIF uniquement (SVG refusé pour sécurité).",
      },
      { status: 415 },
    );
  }

  // Hash SHA-256 du contenu → filename stable & dédupliqué.
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 32);
  const filename = `${hash}.${detected.ext}`;

  // `process.cwd()` pointe sur `/app` dans le container, à la racine du
  // projet en local — public/uploads/ est donc accessible dans les 2 cas.
  const uploadsDir = join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const filepath = join(uploadsDir, filename);
  // writeFile avec flag 'wx' échoue si le fichier existe — c'est ce qu'on
  // veut pour la dédup (silencieusement OK, on retourne l'URL existante).
  try {
    await writeFile(filepath, bytes, { flag: "wx" });
  } catch (err) {
    // EEXIST = fichier déjà là (même contenu) → OK, dédup silencieuse
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
      throw err;
    }
  }

  const url = `/uploads/${filename}`;

  await logAdminAction(guard.user.id, "UPLOAD_IMAGE", `upload:${hash}`, {
    filename,
    mime: detected.mime,
    bytes: file.size,
    url,
  });

  return Response.json({ ok: true, url, filename, mime: detected.mime, bytes: file.size });
}
