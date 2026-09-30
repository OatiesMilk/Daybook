"use client";

import { useId, useState, useSyncExternalStore, useTransition } from "react";
import { draftActivitiesAction } from "@dtr/reports/application/ai-draft";
import { AI_NOTES_MAX_CHARS } from "@dtr/reports/domain/ai-draft";
import type { ActivityRow } from "@dtr/reports/domain/rules";

type Message = { tone: "success" | "danger"; text: string } | null;

// Open/closed is a per-browser convenience. Storage can be unavailable (private mode),
// so every access is guarded and the panel simply starts collapsed.
const OPEN_KEY = "daybook.ai-draft-open";
const OPEN_EVENT = "daybook:ai-draft-open";
function readOpen() { try { return localStorage.getItem(OPEN_KEY) === "1"; } catch { return false; } }
function subscribeOpen(notify: () => void) {
  window.addEventListener("storage", notify); window.addEventListener(OPEN_EVENT, notify);
  return () => { window.removeEventListener("storage", notify); window.removeEventListener(OPEN_EVENT, notify); };
}
function writeOpen(open: boolean) {
  try { localStorage.setItem(OPEN_KEY, open ? "1" : "0"); } catch { /* the choice lasts until reload */ }
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function AiDraft({ date, applyDraft }: { date: string; applyDraft: (rows: ActivityRow[]) => string | null }) {
  const id = useId();
  const open = useSyncExternalStore(subscribeOpen, readOpen, () => false);
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

  return <details className="ai-draft" open={open} onToggle={event => { if (event.currentTarget.open !== open) writeOpen(event.currentTarget.open); }}>
    <summary className="ai-draft-summary">
      <span className="ai-draft-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z" /><path d="M19 3v4M17 5h4" />
        </svg>
      </span>
      <span className="min-w-0 flex-1"><span className="block font-bold">Draft with AI</span><span className="block text-sm text-muted">Turn rough notes into activity rows you can edit</span></span>
      <svg className="ai-draft-chevron" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </summary>
    <form onSubmit={submit} className="ai-draft-body space-y-3">
      <label htmlFor={`${id}-notes`}>Your notes</label>
      <textarea id={`${id}-notes`} rows={4} value={notes} disabled={pending}
        aria-describedby={`${id}-hint ${id}-count`} aria-invalid={tooLong || undefined}
        placeholder="e.g. fixed login redirect bug, reviewed Marco's PR, sprint planning with PM"
        onChange={event => { setNotes(event.target.value); if (message?.tone === "success") setMessage(null); }} />
      <div className="flex items-start justify-between gap-3 text-xs">
        <p id={`${id}-hint`} className="text-muted">Only these notes go to Gemini. No emails, phones, or passwords.</p>
        <p id={`${id}-count`} className={`shrink-0 tabular-nums ${tooLong ? "font-semibold text-danger-ink" : "text-muted"}`}>{notes.length}/{AI_NOTES_MAX_CHARS}</p>
      </div>
      <details className="ai-draft-details text-xs text-muted">
        <summary>How it works</summary>
        <p className="mt-2">Nothing is saved until you click Save draft. Tasks are marked Ongoing unless your notes say they&apos;re done. Only these notes and the report date are sent to Google Gemini, whose data-use terms apply. Notes containing emails, phone numbers, or passwords are blocked before sending.</p>
      </details>
      <button className="primary-button ai-draft-submit" disabled={pending || !notes.trim() || tooLong}>
        {pending ? <><span className="ai-spinner" aria-hidden="true" />Drafting…</> : "Draft activities"}
      </button>
      <p role="status" aria-live="polite" className="sr-only">{pending ? "Drafting activities with Gemini." : message?.tone === "success" ? message.text : ""}</p>
      {message && <p role={message.tone === "danger" ? "alert" : undefined} className="notice" data-tone={message.tone}>{message.text}</p>}
    </form>
  </details>;
}
