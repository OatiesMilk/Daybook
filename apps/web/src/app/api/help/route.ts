import { handleHelp } from "@/help/application/handler";
import { authorizeHelp } from "@/help/infrastructure/access";

export const runtime = "nodejs";
export const maxDuration = 10;
export async function POST(request: Request) {
  return handleHelp(request, { authorize: authorizeHelp, enabled: process.env.DAYBOOK_HELP_ENABLED !== "false" });
}
