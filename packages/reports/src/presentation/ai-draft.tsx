"use client";

import { useId, useState, useTransition } from "react";
import { draftActivitiesAction } from "@dtr/reports/application/ai-draft";
import { AI_NOTES_MAX_CHARS } from "@dtr/reports/domain/ai-draft";
import type { ActivityRow } from "@dtr/reports/domain/rules";

type Message = { tone: "success" | "danger"; text: string } | null;

export function AiDraft({ date, applyDraft }: { date: string; applyDraft: (rows: ActivityRow[]) => string | null }) {
  const id = useId();
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();
  const tooLong = notes.length > AI_NOTES_MAX_CHARS;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !notes.trim() || tooLong) return;
    setMessage(null);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof draftActivitiesAction>>;
      try { result = await draftActivitiesAction(date, notes); }
      catch { setMessage({ tone: "danger", text: "AI drafting couldn't be reached. Your notes are still here; try again." }); return; }
      if ("error" in result) { setMessage({ tone: "danger", text: result.error }); return; }
      const mergeError = applyDraft(result.rows);
      if (mergeError) { setMessage({ tone: "danger", text: mergeError }); return; }
      const count = result.rows.length;
      setNotes("");
      setMessage({ tone: "success", text: `Added ${count} ${count === 1 ? "activity" : "activities"} marked "AI draft". Review each one, then Save draft.` });
    });
  }

  return <section className="rounded-lg border border-line bg-soft p-4" aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`} className="flex items-center gap-2 font-bold">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-accent">
        <path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z" /><path d="M19 3v4M17 5h4" />
      </svg>
      Draft with AI
    </h3>
    <p className="muted-copy mt-1">Jot down what you did today. Gemini turns it into activity rows you can edit. Nothing is saved until you click Save draft.</p>
    <form onSubmit={submit} className="mt-4 space-y-3">
      <label htmlFor={`${id}-notes`}>Your notes</label>
      <textarea id={`${id}-notes`} rows={4} value={notes} disabled={pending}
        aria-describedby={`${id}-hint ${id}-count`} aria-invalid={tooLong || undefined}
        placeholder="e.g. fixed login redirect bug, reviewed Marco's PR, sprint planning with PM"
        onChange={event => { setNotes(event.target.value); if (message?.tone === "success") setMessage(null); }} />
      <div className="flex flex-wrap items-start justify-between gap-2 text-xs">
        <p id={`${id}-hint`} className="max-w-md text-muted">Tasks are marked Ongoing unless your notes say they&apos;re done. Only these notes and the report date are sent to Google Gemini. Leave out emails, phone numbers, and passwords.</p>
        <p id={`${id}-count`} className={tooLong ? "font-semibold text-danger-ink" : "text-muted"}>{notes.length}/{AI_NOTES_MAX_CHARS}</p>
      </div>
      <button className="primary-button ai-draft-submit" disabled={pending || !notes.trim() || tooLong}>
        {pending ? <><span className="ai-spinner" aria-hidden="true" />Drafting…</> : "Draft activities"}
      </button>
      <p role="status" aria-live="polite" className="sr-only">{pending ? "Drafting activities with Gemini." : message?.tone === "success" ? message.text : ""}</p>
      {message && <p role={message.tone === "danger" ? "alert" : undefined} className="notice" data-tone={message.tone}>{message.text}</p>}
    </form>
  </section>;
}
