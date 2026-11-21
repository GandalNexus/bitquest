/**
 * CORS centralisé — endpoints cross-origin BitLab ↔ BitQuest.
 *
 * Comportement :
 *   - Dev (NODE_ENV !== "production") : si `BITLAB_ALLOWED_ORIGINS` est vide
 *     ou égale "*", on reflète l'Origin entrante (permissif, logué uniquement
 *     via logger si besoin). Facilite les parcours tunnelés (ngrok, cloudflared).
 *   - Prod (NODE_ENV === "production") : liste explicite OBLIGATOIRE.
 *     Si la variable est absente, vide, ou contient "*", TOUTES les requêtes
 *     cross-origin sont rejetées (aucun header Access-Control-Allow-Origin émis).
 *     Pas de wildcard, pas d'origin réfléchie.
 *
 * Toujours strip trim + filter pour supporter `a,b , c` sans surprise.
 */

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Liste des origines autorisées par la configuration brute.
 * Renvoie `null` quand la configuration est permissive (wildcard ou vide en dev).
 * Renvoie `[]` quand la configuration refuse tout (prod sans liste explicite).
 */
export function allowedOrigins(): string[] | null {
  const raw = process.env.BITLAB_ALLOWED_ORIGINS?.trim();
  if (!raw || raw === "*") {
    return isProd() ? [] : null;
  }
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s !== "*");
  if (list.length === 0) return isProd() ? [] : null;
  return list;
}

/**
 * Vérifie si une origine spécifique est autorisée.
 *   - Permissif (null)   → true si origin fourni, sinon false.
 *   - Liste explicite    → true si origin exactement dans la liste.
 *   - Refus total ([])   → false toujours.
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  const list = allowedOrigins();
  if (list === null) return true;
  return list.includes(origin);
}

/**
 * Headers CORS à émettre pour une requête donnée.
 *   - Si origin autorisée → émet Access-Control-Allow-Origin exactement
 *     (jamais `*` même en permissif : on reflète l'Origin entrant).
 *   - Si refusée → pas de header Allow-Origin émis ; le navigateur bloquera
 *     la réponse, le serveur ne divulgue rien.
 *
 * @param methods Liste des méthodes HTTP exposées (défaut POST, OPTIONS).
 */
export function corsHeaders(
  reqOrigin: string | null,
  methods: string[] = ["POST", "OPTIONS"],
): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": methods.join(", "),
    "Access-Control-Allow-Headers": "content-type, authorization",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
  if (isOriginAllowed(reqOrigin) && reqOrigin) {
    headers["Access-Control-Allow-Origin"] = reqOrigin;
  }
  return headers;
}

/** Preflight OPTIONS 204 standardisée. */
export function preflight(req: Request, methods?: string[]): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin"), methods),
  });
}
