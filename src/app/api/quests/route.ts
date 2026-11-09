import { authenticate, unauthorized } from "@/lib/bitquest/session";
import { getQuestsWithState } from "@/lib/bitquest/quests";

export async function GET(req: Request) {
  const user = await authenticate(req);
  if (!user) return unauthorized();
  const quests = await getQuestsWithState(user.id);
  return Response.json({ quests });
}
