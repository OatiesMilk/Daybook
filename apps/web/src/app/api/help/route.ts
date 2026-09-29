import { handleHelp } from "@/help/application/handler";
import { authorizeHelp } from "@/help/infrastructure/access";
import { answerWithGemini, helpModelConfiguration } from "@/help/infrastructure/gemini";

export const runtime = "nodejs";
export const maxDuration = 15;
export async function POST(request: Request) {
  return handleHelp(request, { authorize: authorizeHelp, enabled: process.env.DAYBOOK_HELP_ENABLED !== "false", generate: answerWithGemini, model: helpModelConfiguration() });
}
