const DEFAULT_MODEL = "gemini-3.5-flash-lite";

export function geminiConfiguration() {
  const configured = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const valid = /^[a-z0-9.-]{1,100}$/.test(configured);
  return { name: valid ? configured : DEFAULT_MODEL,
    enabled: valid && Boolean(process.env.GEMINI_API_KEY?.trim()) && process.env.DAYBOOK_GEMINI_ENABLED !== "false" };
}

export type StructuredRequest = {
  systemInstruction: string;
  userText: string;
  responseSchema: object;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
  maxResponseBytes: number;
  signal: AbortSignal;
};

// One bounded request: no retries, history, tools, or logging of content. Returns the
// parsed JSON the model produced, or null on any failure so callers pick their own fallback.
export async function generateStructured(request: StructuredRequest, fetcher: typeof fetch = fetch): Promise<unknown | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  const configuration = geminiConfiguration();
  if (!key || !configuration.enabled || request.signal.aborted) return null;
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(request.timeoutMs)]);
  try {
    const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${configuration.name}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal, cache: "no-store",
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: request.userText }] }],
        generationConfig: { temperature: request.temperature, maxOutputTokens: request.maxOutputTokens,
          responseMimeType: "application/json", responseSchema: request.responseSchema },
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
        if (size > request.maxResponseBytes) { await reader.cancel(); return null; }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    if (signal.aborted) return null;
    const result = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
    const candidate = result.candidates?.[0];
    if (candidate?.finishReason !== "STOP") return null;
    const text = candidate.content?.parts?.filter(part => !part.thought).map(part => part.text ?? "").join("");
    return text ? JSON.parse(text) as unknown : null;
  } catch { return null; }
}
