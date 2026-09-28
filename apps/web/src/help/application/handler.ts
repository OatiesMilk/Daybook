import { answerHelp, isHelpReply, parseHelpRequest } from "../domain/answer.ts";

export type HelpAccess = { acquire: () => Promise<string>; release: (permit: string) => Promise<void> };
type Dependencies = { authorize: () => Promise<HelpAccess | "forbidden" | null>; enabled: boolean };
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

export async function handleHelp(request: Request, dependencies: Dependencies, timeoutMs = 5000): Promise<Response> {
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
      const reply = answerHelp(message);
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
