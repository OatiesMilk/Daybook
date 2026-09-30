import { answerHelp, isHelpReply, parseHelpRequest, type HelpReply } from "../domain/answer.ts";
import { contextQuestion } from "../domain/conversation.ts";

export type HelpAccess = { acquire: () => Promise<string>; release: (permit: string) => Promise<void>;
  accountName?: (signal: AbortSignal) => Promise<string | null> };
type Dependencies = { authorize: () => Promise<HelpAccess | "forbidden" | null>; enabled: boolean;
  generate?: (message: string, signal: AbortSignal) => Promise<HelpReply | null>;
  model?: { enabled: boolean; name: string } };
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
const unavailable = () => json({ error: "Daybook Help is temporarily unavailable. Try again shortly." }, 503);

// Stream cap is authoritative, even if Content-Length is absent or dishonest.
async function boundedBody(request: Request, signal: AbortSignal) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty");
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (signal.aborted) throw new Error("timeout");
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); throw new Error("oversized"); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } finally { signal.removeEventListener("abort", abort); reader.releaseLock(); }
}

export async function handleHelp(request: Request, dependencies: Dependencies, timeoutMs = 8000): Promise<Response> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Cross-site requests are not allowed." }, 403);
  if (request.headers.get("sec-fetch-site") === "cross-site") return json({ error: "Cross-site requests are not allowed." }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "Send a JSON question." }, 415);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const operation = async () => {
    const access = await dependencies.authorize();
    if (controller.signal.aborted) return unavailable();
    if (!access) return json({ error: "Sign in to use Daybook Help." }, 401);
    if (access === "forbidden") return json({ error: "Your account does not have active access." }, 403);
    if (!dependencies.enabled) return unavailable();
    let message: string | null;
    try { message = parseHelpRequest(await boundedBody(request, controller.signal)); }
    catch (cause) {
      return json({ error: "Send one question of 800 characters or fewer." }, cause instanceof Error && cause.message === "oversized" ? 413 : 400);
    }
    if (!message) return json({ error: "Send one question of 800 characters or fewer. Chat history is not accepted." }, 400);
    if (controller.signal.aborted) return unavailable();
    const permit = await access.acquire();
    if (permit === "limited" || permit === "busy") return Response.json({ error: permit === "busy" ? "Another help question is being processed. Retry shortly." : "Help request limit reached. Retry later." }, { status: 429, headers: { ...headers, "Retry-After": permit === "busy" ? "10" : "60" } });
    if (!/^[0-9a-f-]{36}$/i.test(permit)) throw new Error("invalid permit");
    try {
      if (controller.signal.aborted) return unavailable();
      let reply = answerHelp(message);
      const context = contextQuestion(message);
      if (context === "account") {
        let name: string | null = null;
        try { name = await access.accountName?.(controller.signal) ?? null; } catch { /* Profile unavailable. */ }
        const safeName = name?.replace(/[<>`\r\n]/g, "").trim().slice(0, 150);
        reply = { context, sources: [], text: safeName && !/(?:https?:|www\.|\]\()/i.test(safeName)
          ? `You're signed in as ${safeName}. This is the account associated with your current session.`
          : "You're signed into your own Daybook account. I couldn't load your profile name; open the account menu (your initials, top right) to check it." };
      } else if (context === "model") {
        reply = { context, sources: [], text: dependencies.model?.enabled
          ? `Daybook Help is configured to use Google Gemini (${dependencies.model.name}). Some replies come from the built-in FAQ fallback when Gemini is unavailable. This model information is provided directly by Daybook.`
          : "Daybook Help is currently using built-in FAQ answers. Gemini is not configured or is disabled." };
      } else if (!reply.sources.some(source => source.id === "help-capabilities")) {
        try {
          const generated = await dependencies.generate?.(message, controller.signal);
          if (generated && isHelpReply(generated) && !generated.context) reply = generated;
        } catch { /* Provider failures keep the approved FAQ fallback available. */ }
      }
      if (controller.signal.aborted) return unavailable();
      if (!isHelpReply(reply)) throw new Error("invalid answer");
      return json(reply);
    } finally { await access.release(permit); }
  };
  try {
    return await Promise.race([
      operation(),
      new Promise<Response>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(unavailable()); }, timeoutMs); }),
    ]);
  } catch { return unavailable(); }
  finally { if (timer) clearTimeout(timer); }
}
