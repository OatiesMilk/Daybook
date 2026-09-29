import "server-only";
import { canAskModel, helpResponseSchema, helpSystemInstruction, parseModelAnswer } from "../domain/model-answer.ts";
import type { HelpReply } from "../domain/answer.ts";

export function helpModelConfiguration() {
  const configured = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
  const valid = /^[a-z0-9.-]{1,100}$/.test(configured);
  return { name: valid ? configured : "gemini-3.5-flash-lite",
    enabled: valid && Boolean(process.env.GEMINI_API_KEY?.trim()) && process.env.DAYBOOK_GEMINI_ENABLED !== "false" };
}

export async function answerWithGemini(message: string, signal: AbortSignal): Promise<HelpReply | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  const configuration = helpModelConfiguration();
  if (!key || !configuration.enabled || signal.aborted || !canAskModel(message)) return null;
  const model = configuration.name;
  // One bounded request, no retries, history, account IDs, records, tools, or logs.
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(6000)]);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal: requestSignal, cache: "no-store",
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: helpSystemInstruction }] },
        contents: [{ role: "user", parts: [{ text: message }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 600, responseMimeType: "application/json", responseSchema: helpResponseSchema },
      }),
    });
    if (!response.ok || !response.body) { await response.body?.cancel(); return null; }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 16384) { await reader.cancel(); return null; }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    if (requestSignal.aborted) return null;
    const bytes = Buffer.concat(chunks);
    const result = JSON.parse(bytes.toString("utf8")) as { candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
    const candidate = result.candidates?.[0];
    if (candidate?.finishReason !== "STOP") return null;
    const text = candidate.content?.parts?.filter(part => !part.thought).map(part => part.text ?? "").join("");
    return text ? parseModelAnswer(JSON.parse(text)) : null;
  } catch { return null; }
}
