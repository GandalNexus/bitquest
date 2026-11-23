import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * L'authentification BitQuest est entièrement client-side (localStorage + x-gn-user-id
 * / x-gn-token). Les pages client affichent AuthScreen lorsqu'aucune session n'est
 * détectée ; aucun redirect côté middleware n'est nécessaire pour l'instant.
 *
 * Ce middleware est conservé comme point d'ancrage pour la Phase 1 sécurité
 * (cookies signés, protection CSRF, etc.).
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
