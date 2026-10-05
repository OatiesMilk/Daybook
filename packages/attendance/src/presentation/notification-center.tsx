"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import type { Reminder } from "../domain/reminders";
import { activeReminders, defaultReminderPreferences, parseReminderPreferences } from "../domain/reminder-preferences";

const defaults = defaultReminderPreferences;
const fallback = JSON.stringify(defaults);
const eventName = "daybook-reminders-updated";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(eventName, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(eventName, callback); };
}

type ReminderData = { reminders: Reminder[]; userId: string };

export function NotificationCenter({ load }: { load: () => Promise<ReminderData> }) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const request = useRef(0);
  const id = useId();
  const [data, setData] = useState<ReminderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [open, setOpen] = useState(false);
  const reminders = data?.reminders ?? [];
  const key = `daybook:reminders:${data?.userId ?? "pending"}`;
  const snapshot = useSyncExternalStore(subscribe, () => {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  }, () => fallback);
  const preferences = useMemo(() => parseReminderPreferences(snapshot), [snapshot]);
  const [error, setError] = useState("");
  const active = activeReminders(reminders, preferences);
  const dismissed = reminders.filter(item => preferences.dismissed.includes(item.id));
  const refresh = useCallback(() => {
    const current = ++request.current;
    return load().then(result => {
      if (current !== request.current) return;
      setData(result); setLoadError("");
    }, () => {
      if (current !== request.current) return;
      setData(null); setLoadError("Could not load reminders. Retry, or sign in again if your session ended.");
    }).finally(() => { if (current === request.current) setLoading(false); });
  }, [load]);
  function position() {
    if (!dialog.current || !trigger.current) return;
    const rect = trigger.current.getBoundingClientRect();
    const width = Math.min(416, window.innerWidth - 24);
    dialog.current.style.setProperty("--reminder-top", `${Math.min(rect.bottom + 8, window.innerHeight - 120)}px`);
    dialog.current.style.setProperty("--reminder-right", `${Math.min(Math.max(12, window.innerWidth - rect.right), window.innerWidth - width - 12)}px`);
  }
  function close() { dialog.current?.close(); }
  function show() {
    setOpen(true); setLoading(true);
    void refresh();
  }
  function save(next: typeof preferences) {
    if (!data) return;
    try {
      // Drop obsolete dismissal IDs as their underlying records are resolved or age out.
      localStorage.setItem(key, JSON.stringify({ ...next, dismissed: next.dismissed.filter(id => reminders.some(item => item.id === id)) }));
      window.dispatchEvent(new Event(eventName));
      setError("");
    } catch { setError("This browser blocked preference storage. Your changes could not be saved."); }
  }
  useEffect(() => {
    const counter = request;
    void refresh();
    const visibleRefresh = () => { if (document.visibilityState === "visible") void refresh(); };
    const timer = window.setInterval(visibleRefresh, 60_000);
    document.addEventListener("visibilitychange", visibleRefresh);
    return () => { counter.current++; window.clearInterval(timer); document.removeEventListener("visibilitychange", visibleRefresh); };
  }, [refresh, pathname]);
  useEffect(() => {
    if (!open) return;
    // The panel contents mount with open, before native dialog focus is assigned.
    position(); dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("resize", position);
    return () => { document.body.style.overflow = previous; window.removeEventListener("resize", position); };
  }, [open]);

  return <>
    <button ref={trigger} type="button" className="notification-bell" aria-haspopup="dialog" aria-expanded={open} aria-controls={id} aria-label={`Open reminders${data ? `, ${active.length} active` : ""}`} onClick={show}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      {data && active.length > 0 && <span className="notification-count" aria-hidden="true">{active.length > 99 ? "99+" : active.length}</span>}
    </button>
    <dialog ref={dialog} id={id} className="notification-popup" aria-labelledby={open ? `${id}-heading` : undefined} onClose={() => { setOpen(false); trigger.current?.focus(); }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    }}>
      {/* Closed panels have identical, empty contents on the server and during hydration. */}
      {open && <>
      <div className="notification-popup-header"><h2 id={`${id}-heading`} className="section-title">Reminders{data ? ` (${active.length})` : ""}</h2><button type="button" className="secondary-button" onClick={close}>Close</button></div>
      <div className="notification-popup-body">
      <p className="muted-copy" role="status">{loading && !data ? "Loading reminders…" : loadError || (active.length ? "Choose a reminder to finish the entry." : "No active reminders in the last 30 days.")}</p>
      <button type="button" className="secondary-button mt-3" disabled={loading} onClick={() => { setLoading(true); void refresh(); }}>{loading ? "Refreshing…" : "Refresh"}</button>
      <ul className="notification-list mt-5">{active.map(item => <li key={item.id} className="notification-item">
        <div><p className="text-sm text-muted"><time dateTime={item.date}>{item.date}</time></p><h3 className="mt-1 font-semibold">{item.title}</h3><p className="muted-copy mt-2">{item.description}</p></div>
        <div className="flex flex-wrap gap-2"><Link className="primary-button" href={item.href} onClick={close}>{item.kind === "time_out" ? "Add time out" : "Open report"}</Link><button type="button" className="secondary-button" aria-label={`Dismiss ${item.title.toLowerCase()} for ${item.date}`} onClick={() => save({ ...preferences, dismissed: [...preferences.dismissed, item.id] })}>Dismiss</button></div>
      </li>)}</ul>
      {dismissed.length > 0 && <button className="secondary-button mt-5" type="button" onClick={() => save({ ...preferences, dismissed: [] })}>Restore {dismissed.length} dismissed reminder{dismissed.length === 1 ? "" : "s"}</button>}
      <Link className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-accent underline" href="/history?state=open" onClick={close}>Check older unfinished attendance</Link>
    <details className="notification-preferences mt-4"><summary>Reminder preferences</summary>
      <fieldset disabled={!data} className="mt-4 grid gap-3"><legend className="sr-only">Reminder types</legend><label className="checkbox-option"><input type="checkbox" checked={preferences.time_out} onChange={event => save({ ...preferences, time_out: event.target.checked })} />Time out</label><label className="checkbox-option"><input type="checkbox" checked={preferences.report} onChange={event => save({ ...preferences, report: event.target.checked })} />DAR preparation and submission</label></fieldset>
      <p className="muted-copy mt-4">Preferences and dismissals apply to your account in this browser only. Dismissing a reminder does not change attendance or reports.</p>
      {error && <p role="alert" className="notice mt-4" data-tone="danger">{error}</p>}
    </details>
    </div></>}
    </dialog>
  </>;
}
