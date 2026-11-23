/**
 * Validation client-side d'un paramètre `returnTo` reçu en query param.
 *
 * Utilisé par la home BitQuest pour détecter un retour SSO BitLab
 * (via `/api/auth/bitlab-sso` quand pas de session). Après login, on
 * renavigue vers la route SSO qui fera la validation stricte d'origine
 * côté serveur (allowlist `BITLAB_ALLOWED_ORIGINS`).
 *
 * Côté client on fait une validation **défensive minimale** :
 *   - URL parseable
 *   - protocole http(s) uniquement (anti `javascript:`, `data:`, etc.)
 *   - longueur raisonnable (anti ReDoS / abus)
 *
 * La vraie allowlist est serveur-side et non reproductible ici
 * (variable d'environnement). On ne refuse pas des URLs inconnues : on
 * laisse le serveur trancher. Le point important est qu'on n'exécute
 * aucune URL dangereuse en `window.location.href`.
 */

const MAX_RETURN_TO_LENGTH = 2048;

export function isSafeReturnTo(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  if (raw.length === 0 || raw.length > MAX_RETURN_TO_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

/**
 * Construit l'URL de rebond SSO à utiliser après login réussi.
 * Chemin relatif → navigue sur BitQuest, puis BitQuest redirige vers
 * BitLab (ou ailleurs, selon l'allowlist serveur).
 */
export function buildBitlabSsoRedirectUrl(returnTo: string): string {
  const params = new URLSearchParams({ returnTo });
  return `/api/auth/bitlab-sso?${params.toString()}`;
}
