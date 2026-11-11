/**
 * Version du contrat d'intégration BitQuest ↔ BitLab.
 *
 * Partagée entre les deux canaux d'intégration :
 *   - JWT challenge/proof (`src/lib/bitlab/jwt.ts`)
 *   - Deep-link HMAC signé (`src/lib/bitlab/deep-link.ts`)
 *
 * À bumper uniquement quand une évolution du format rend les anciens
 * tokens / URLs incompatibles. Pour un simple ajout facultatif, pas de bump.
 *
 * Règles de compatibilité :
 *   - À l'émission : tout nouveau token/URL embarque `v: PROTOCOL_VERSION`.
 *   - À la réception :
 *     - `v` absent → toléré (grâce legacy, disparaît naturellement avec les TTL).
 *     - `v === PROTOCOL_VERSION` → accepté.
 *     - `v > PROTOCOL_VERSION` → rejeté (protection anti-downgrade serveur).
 *     - `v` non entier ou < 1 → rejeté.
 */
export const PROTOCOL_VERSION = 1;
