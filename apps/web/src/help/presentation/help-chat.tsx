"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { isHelpReply, MAX_MESSAGE, type HelpReply } from "../domain/answer";
import { starterQuestions } from "../domain/knowledge";

type Turn = { question: string; reply?: HelpReply; error?: string };

export function HelpChat() {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);

  function close() { dialog.current?.close(); }
  function show() {
    if (!dialog.current || !trigger.current) return;
    // A native modal makes the reminders launcher inert while Help is open.
    if (document.querySelector("dialog[open]")) return;
    const rect = trigger.current.getBoundingClientRect();
    dialog.current.style.setProperty("--help-top", `${Math.min(rect.bottom + 8, window.innerHeight - 160)}px`);
    dialog.current.showModal(); setOpen(true); input.current?.focus();
  }
  async function ask(value: string, retry = false) {
    const message = value.trim();
    if (!message || message.length > MAX_MESSAGE || controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setLoading(true); setQuestion("");
    setTurns(current => [...(retry ? current.slice(0, -1) : current).slice(-9), { question: message }]);
    const timeout = window.setTimeout(() => request.abort(), 8000);
    try {
      const response = await fetch("/api/help", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }), signal: request.signal, cache: "no-store" });
      const result: unknown = await response.json();
      if (!response.ok) {
        const error = response.status === 401 ? "Your session ended. Sign in again to use Help."
          : response.status === 403 ? "Help is not available for this account."
          : response.status === 429 ? "Help is busy or a request limit was reached. Wait before retrying."
          : "Daybook Help is unavailable right now. Try again shortly.";
        throw new Error(error);
      }
      if (!isHelpReply(result)) throw new Error("Daybook Help returned an unavailable response. Retry shortly.");
      if (controller.current !== request) return;
      setTurns(current => current.map((turn, index) => index === current.length - 1 ? { ...turn, reply: result } : turn));
    } catch (cause) {
      if (controller.current !== request) return;
      const error = request.signal.aborted ? "The help request timed out. Try again." : cause instanceof Error ? cause.message : "Could not load Help. Try again.";
      setTurns(current => current.map((turn, index) => index === current.length - 1 ? { ...turn, error } : turn));
    } finally {
      window.clearTimeout(timeout);
      if (controller.current === request) { controller.current = null; setLoading(false); }
    }
  }
  function clear() {
    controller.current?.abort(); controller.current = null;
    setTurns([]); setQuestion(""); setLoading(false); input.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [turns, loading]);
  useEffect(() => () => { controller.current?.abort(); controller.current = null; }, []);

  return <>
    <button ref={trigger} className="help-launcher" type="button" aria-label="Open Daybook Help" aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={show}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H3l1.8-4A8.5 8.5 0 1 1 21 11.5Z" /><path d="M9.5 8.5a2 2 0 0 1 4 0c0 1.5-2 1.5-2 3M11.5 14h.01" /></svg>
      <span className="help-launcher-label">Help</span>
    </button>
    <dialog ref={dialog} id={id} className="help-popup" aria-labelledby={`${id}-heading`} aria-describedby={`${id}-scope`} onClose={() => { setOpen(false); trigger.current?.focus(); }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    }}>
      <div className="notification-popup-header"><div><h2 id={`${id}-heading`} className="section-title">Daybook Help</h2><p id={`${id}-scope`} className="muted-copy mt-1">Answers questions about Daybook only.</p></div><button type="button" className="secondary-button" onClick={close}>Close</button></div>
      <div ref={log} className="help-log" role="log" aria-label="Help conversation" aria-live="polite" aria-relevant="additions text">
        {!turns.length && <div><h3 className="font-semibold">How can I help you use Daybook?</h3><p className="muted-copy mt-2">Verified FAQs only. I cannot read your records, change anything, or write your DAR.</p><div className="help-starters mt-4">{starterQuestions.map(item => <button type="button" className="secondary-button" key={item} onClick={() => { void ask(item); }}>{item}</button>)}</div></div>}
        {turns.map((turn, index) => <div className="help-turn" key={index}>
          <p className="help-question"><span className="sr-only">You: </span>{turn.question}</p>
          {turn.reply && <div className="help-answer"><span className="sr-only">Daybook Help: </span><p className="whitespace-pre-wrap">{turn.reply.text}</p>{turn.reply.sources.length > 0 && <ul className="help-sources">{turn.reply.sources.map(source => <li key={source.id}><Link href={source.href} onClick={close}>{source.label}</Link></li>)}</ul>}</div>}
          {turn.error && <div className="notice" data-tone="danger"><p>{turn.error}</p><button type="button" className="secondary-button mt-2" disabled={loading} onClick={() => { void ask(turn.question, index === turns.length - 1); }}>Retry question</button></div>}
        </div>)}
        {loading && <p className="muted-copy" role="status">Finding verified guidance…</p>}
      </div>
      <form className="help-composer" onSubmit={event => { event.preventDefault(); void ask(question); }}>
        <label htmlFor={`${id}-question`}>Ask about a Daybook feature</label>
        <div className="help-input-row"><input ref={input} id={`${id}-question`} value={question} maxLength={MAX_MESSAGE} autoComplete="off" enterKeyHint="send" onChange={event => setQuestion(event.target.value)} placeholder="How do I submit my DAR?" aria-describedby={`${id}-privacy`} /><button className="primary-button" disabled={loading || !question.trim()}>Send</button></div>
        <div className="help-footer"><p id={`${id}-privacy`} className="muted-copy">Chat is kept only in this page’s memory. Don’t share sensitive information.</p><button type="button" className="secondary-button" onClick={clear} disabled={!turns.length && !question}>Clear chat</button></div>
      </form>
    </dialog>
  </>;
}
