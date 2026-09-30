import "server-only";
import { generateStructured, geminiConfiguration } from "@dtr/shared/infrastructure/gemini";
import { canAskModel, helpResponseSchema, helpSystemInstruction, parseModelAnswer } from "../domain/model-answer.ts";
import type { HelpReply } from "../domain/answer.ts";

export const helpModelConfiguration = geminiConfiguration;

export async function answerWithGemini(message: string, signal: AbortSignal): Promise<HelpReply | null> {
  if (!canAskModel(message)) return null;
  // Only the question and public guidance are sent: no account IDs, records or history.
  const generated = await generateStructured({
    systemInstruction: helpSystemInstruction, userText: message, responseSchema: helpResponseSchema,
    temperature: 0.2, maxOutputTokens: 600, timeoutMs: 6000, maxResponseBytes: 16384, signal,
  });
  return generated === null ? null : parseModelAnswer(generated);
}
