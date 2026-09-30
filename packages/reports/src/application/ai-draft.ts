"use server";
import "server-only";
import { requireOwner } from "@dtr/identity/application/auth";
import { internshipToday, validateWorkday } from "@dtr/attendance/domain/index";
import { generateStructured, geminiConfiguration } from "@dtr/shared/infrastructure/gemini";
import { draftResponseSchema, draftSystemInstruction, draftUserText, parseDraftRows, validateDraftNotes } from "../domain/ai-draft";
import type { ActivityRow } from "../domain/rules";

export type DraftResult = { rows: ActivityRow[] } | { error: string };

const unavailable = { error: "AI drafting is temporarily unavailable. Your notes are still here; try again shortly." };

// Logs a reason category only. Notes, rows and keys are never written to logs.
function note(reason: string) { console.warn(`[ai-draft] ${reason}`); }

export async function draftActivitiesAction(date: unknown, notes: unknown): Promise<DraftResult> {
  const { supabase } = await requireOwner();
  if (!geminiConfiguration().enabled) return { error: "AI drafting isn't set up on this server yet." };

  let reportDate: string;
  let cleanNotes: string;
  try {
    if (typeof date !== "string") throw new Error("Choose a valid report date.");
    validateWorkday(date);
    if (date > internshipToday()) throw new Error("Choose today or an earlier date.");
    reportDate = date;
    cleanNotes = validateDraftNotes(notes);
  } catch (cause) { return { error: cause instanceof Error ? cause.message : "Check your notes and try again." }; }

  const { data: permit, error: permitError } = await supabase.rpc("acquire_ai_draft_request").abortSignal(AbortSignal.timeout(2500));
  if (permitError || !permit) { note("limiter unavailable"); return unavailable; }
  if (permit === "limited") return { error: "You've reached the AI drafting limit (5 per minute, 30 per day). Try again later." };
  if (permit === "busy") return { error: "Another draft is still being generated. Wait a few seconds and try again." };
  if (!/^[0-9a-f-]{36}$/i.test(permit)) { note("invalid permit"); return unavailable; }

  try {
    const generated = await generateStructured({
      systemInstruction: draftSystemInstruction, userText: draftUserText(reportDate, cleanNotes),
      responseSchema: draftResponseSchema, temperature: 0.2, maxOutputTokens: 2048,
      timeoutMs: 12000, maxResponseBytes: 32768, signal: AbortSignal.timeout(14000),
    });
    if (generated === null) { note("provider failure"); return unavailable; }
    const rows = parseDraftRows(generated);
    if (rows) return { rows };
    const empty = typeof generated === "object" && generated !== null && Array.isArray((generated as { rows?: unknown }).rows)
      && (generated as { rows: unknown[] }).rows.length === 0;
    if (!empty) note("rejected output");
    return { error: empty
      ? "No work activities were found in these notes. Add what you worked on and try again."
      : "Gemini's draft didn't pass validation. Try rephrasing your notes, or retry." };
  } finally {
    // A failed release is harmless: the lease expires on its own after 20 seconds.
    const { error } = await supabase.rpc("release_ai_draft_request", { permit }).abortSignal(AbortSignal.timeout(2500));
    if (error) note("permit release failed");
  }
}
