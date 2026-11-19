/**
 * GET /api/admin/whoami — diagnostic auth. Retourne ce que le serveur voit.
 * Pas de garde role pour debugger les cas où requireRole refuse.
 */
import { authenticate } from "@/lib/bitquest/session";

export async function GET(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  const user = await authenticate(req);
  return Response.json(
    {
      hasCookie: !!cookieHeader,
      cookieNames: cookieHeader
        ? cookieHeader.split(";").map((c) => c.trim().split("=")[0])
        : [],
      authenticated: !!user,
      user: user
        ? {
            id: user.id,
            pseudo: user.pseudo,
            role: user.role,
            isGuest: user.isGuest,
            deletedAt: user.deletedAt,
          }
        : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
