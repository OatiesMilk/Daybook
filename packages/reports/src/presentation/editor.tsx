"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { reportAction } from "@dtr/reports/application/actions";
import { formatReportDate, type ActivityRow, type Report } from "@dtr/reports/domain/rules";
import { mergeDraftRows } from "@dtr/reports/domain/ai-draft";
import { collapsedFromPositions, collapsedRowsKey, positionsFromCollapsed } from "@dtr/reports/domain/collapsed-rows";
import { formatMinutes } from "@dtr/attendance/domain/index";
import { ReportImport } from "@dtr/reports/presentation/import";
import { AiDraft } from "@dtr/reports/presentation/ai-draft";
import { ReportSidebar } from "@dtr/reports/presentation/sidebar";
import { useConfirmDialog } from "@dtr/shared/ui/confirm-dialog";

function Command({ report, command, label, primary = false, danger = false }: { report: Report; command: string; label: string; primary?: boolean; danger?: boolean }) {
  const [state, action, pending] = useActionState(reportAction, { error: "" });
  return <form action={action} className="space-y-3">
    <input type="hidden" name="id" value={report.id} /><input type="hidden" name="version" value={report.updated_at} /><input type="hidden" name="date" value={report.report_date} /><input type="hidden" name="command" value={command} />
    {command === "submit" && <div><label className="checkbox-option"><input type="checkbox" name="confirm" required /><span>I have sent this report to my project manager.</span></label></div>}
    {command === "delete" && <div><label className="checkbox-option"><input type="checkbox" name="confirm_delete" required /><span>I understand this draft will be permanently deleted.</span></label></div>}
    <button className={primary ? "primary-button" : `secondary-button${danger ? " danger-button" : ""}`} disabled={pending}>{pending ? "Updating…" : label}</button>
    {state.error && <p role="alert" className="notice" data-tone="danger">{state.error}</p>}
  </form>;
}

const subscribeNever = () => () => {};

function readCollapsed(key: string, ids: string[]): Set<string> {
  try { return collapsedFromPositions(JSON.parse(localStorage.getItem(key) ?? "[]"), ids); }
  catch { return new Set(); }
}

function writeCollapsed(key: string, ids: string[], collapsed: ReadonlySet<string>) {
  const positions = positionsFromCollapsed(ids, collapsed);
  try { if (positions.length) localStorage.setItem(key, JSON.stringify(positions)); else localStorage.removeItem(key); }
  catch { /* Storage unavailable (private mode, blocked): collapsing still works until reload. */ }
}

export function ReportEditor({ report, date, isLatest, aiDraftEnabled = false, sidebar }: { report: Report | null; date: string; isLatest: boolean; aiDraftEnabled?: boolean; sidebar?: ReactNode }) {
  const empty: ActivityRow = { project: "", task: "", status: "Ongoing", remarks: "" };
  const [rows, setRows] = useState<ActivityRow[]>(report?.rows.length ? report.rows : [{ ...empty }]);
  // Stable per-row IDs let drafted rows animate in and keep their "AI draft" badge
  // until edited, without remounting a row (and stealing focus) while you type.
  const nextId = useRef(0);
  const newId = useCallback(() => `row-${nextId.current++}`, []);
  const [ids, setIds] = useState<string[]>(() => rows.map((_, index) => `initial-${index}`));
  const [aiIds, setAiIds] = useState<ReadonlySet<string>>(new Set());
  // Collapsed rows show a one-line summary, so long reports don't need endless scrolling.
  // Keyed by row ID in memory, so collapsing survives edits, removals and new rows (which
  // start open). It is remembered per report date on this device as row positions only.
  // The editor remounts after every save, so the stored choice is read on the first client
  // render (no flash); during hydration rows render open to match the server HTML.
  const storageKey = collapsedRowsKey(date);
  const isClient = useSyncExternalStore(subscribeNever, () => true, () => false);
  const [localCollapsed, setLocalCollapsed] = useState<ReadonlySet<string> | null>(null);
  const storedCollapsed = useMemo(() => isClient ? readCollapsed(storageKey, ids) : new Set<string>(), [isClient, storageKey, ids]);
  const collapsed = localCollapsed ?? storedCollapsed;
  const latestCollapsed = useRef(collapsed);
  useEffect(() => { latestCollapsed.current = collapsed; }, [collapsed]);
  const changeCollapsed = (next: ReadonlySet<string>, rowIds = ids) => { setLocalCollapsed(next); writeCollapsed(storageKey, rowIds, next); };
  const toggleRow = (rowId: string) => {
    const next = new Set(collapsed);
    if (!next.delete(rowId)) next.add(rowId);
    changeCollapsed(next);
  };
  const { confirm, confirmation } = useConfirmDialog();
  const latestIds = useRef(ids);
  useEffect(() => { latestIds.current = ids; }, [ids]);
  const focusId = useRef<string | null>(null);
  const addActivity = useRef<HTMLButtonElement>(null);
  const [state, action, pending] = useActionState(reportAction, { error: "" });
  const editable = (!report || report.status === "draft") && isLatest;
  const unsaved = report ? JSON.stringify(rows) !== JSON.stringify(report.rows) : true;
  const applyImportedRows = useCallback((imported: ActivityRow[]) => {
    const added = imported.map(() => newId());
    setRows(imported); setIds(added); setAiIds(new Set());
    // Imported rows replace everything and start open; drop the old rows' saved positions.
    setLocalCollapsed(new Set()); writeCollapsed(storageKey, added, new Set());
    // Import now lives in the sidebar (below the editor on phones), so move focus,
    // and with it the viewport, to the rows that were just filled.
    focusId.current = added[0] ?? null;
    return true;
  }, [newId, storageKey]);
  // Drafting takes seconds and rows stay editable meanwhile, so merge from the latest rows,
  // not the ones captured when the request started.
  const latestRows = useRef(rows);
  useEffect(() => { latestRows.current = rows; }, [rows]);
  const applyDraft = useCallback((drafted: ActivityRow[]) => {
    let merged: ReturnType<typeof mergeDraftRows>;
    try { merged = mergeDraftRows(latestRows.current, drafted); } catch (cause) { return cause instanceof Error ? cause.message : "The drafted rows could not be added."; }
    const added = drafted.map(() => newId());
    setRows(merged.rows);
    setIds(current => merged.firstNewIndex === 0 ? added : [...current, ...added]);
    setAiIds(current => new Set([...(merged.firstNewIndex === 0 ? [] : current), ...added]));
    // Drafts that replace an untouched editor start open; appended drafts keep earlier positions.
    if (merged.firstNewIndex === 0) { setLocalCollapsed(new Set()); writeCollapsed(storageKey, added, new Set()); }
    focusId.current = added[0];
    return null;
  }, [newId, storageKey]);
  useEffect(() => {
    if (!focusId.current) return;
    document.getElementById(`${focusId.current}-title`)?.focus();
    focusId.current = null;
  }, [ids]);
  function clearAiMark(index: number) {
    const rowId = ids[index];
    if (rowId && aiIds.has(rowId)) setAiIds(current => { const next = new Set(current); next.delete(rowId); return next; });
  }
  function update(index: number, key: keyof ActivityRow, value: string) { setRows(current => current.map((row, i) => i === index ? { ...row, [key]: value } : row)); clearAiMark(index); }
  function remove(index: number) {
    const remaining = latestIds.current.filter((_, i) => i !== index);
    setRows(current => current.filter((_, i) => i !== index)); setIds(remaining);
    // Later rows shift up one position, so re-save the remembered positions.
    const next = new Set(latestCollapsed.current); next.delete(latestIds.current[index]);
    changeCollapsed(next, remaining);
  }
  async function confirmRemoval(rowId: string, index: number, row: ActivityRow) {
    const approved = await confirm({ title: `Remove activity ${index + 1}?`, description: "This activity will be removed from the editor. Your saved report will change only when you save the draft.", detail: row.task || row.project || "This activity is empty.", confirmLabel: "Remove activity", tone: "danger" });
    const currentIndex = latestIds.current.indexOf(rowId);
    if (!approved || currentIndex < 0) return;
    remove(currentIndex);
    requestAnimationFrame(() => {
      const next = latestIds.current[Math.min(currentIndex, latestIds.current.length - 1)];
      if (next) document.getElementById(`${next}-title`)?.focus();
      else addActivity.current?.focus();
    });
  }
  return <><div className="min-w-0"><section className="space-y-6">
    <div className="panel"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="section-title"><time dateTime={date}>{formatReportDate(date)}</time></h2><span className="status" data-tone={report?.needs_review ? "warning" : report?.status === "submitted" ? "success" : undefined}>{report ? `${report.status === "draft" ? "Draft" : report.status === "ready" ? "Ready" : "Submitted"} · version ${report.revision}` : "New draft"}</span></div>
      {report?.needs_review && <p role="alert" className="notice mt-4" data-tone="warning">Attendance changed after this report was saved. Its hours may be outdated. {isLatest ? "Create an updated version below; this version stays saved." : <><Link className="font-semibold underline" href={`/reports?date=${date}`}>Open the latest version</Link> to continue. This older version stays saved.</>}</p>}
      {report?.snapshot && <div className="mt-5 border-t border-line pt-4 text-sm leading-7"><p>{report.snapshot.profile.full_name} · {report.snapshot.profile.school}</p><p>{report.snapshot.profile.department}</p><p className="font-semibold">Cumulative hours: {formatMinutes(report.snapshot.totalMinutes)}</p></div>}
      {editable && aiDraftEnabled && <div className="mt-6"><AiDraft date={date} applyDraft={applyDraft} /></div>}
      {editable ? <form action={action} className="mt-6 space-y-5">
        <input type="hidden" name="date" value={date} /><input type="hidden" name="id" value={report?.id ?? ""} /><input type="hidden" name="version" value={report?.updated_at ?? ""} /><input type="hidden" name="command" value="save" /><input type="hidden" name="rows" value={JSON.stringify(rows)} />
        <fieldset disabled={pending} className="space-y-5">
          {rows.length > 1 && <div className="flex justify-end"><button type="button" className="row-action" onClick={() => changeCollapsed(ids.every(id => collapsed.has(id)) ? new Set() : new Set(ids))}>{ids.every(id => collapsed.has(id)) ? "Expand all" : "Collapse all"}</button></div>}
          {rows.map((row, index) => { const rowId = ids[index] ?? `fallback-${index}`; const drafted = aiIds.has(rowId); const open = !collapsed.has(rowId);
          const summary = [row.project.trim(), row.status, row.task.trim().split("\n")[0]].filter(Boolean).join(" · ");
          return <div key={rowId} className={`border-t border-line pt-5 first:border-t-0 first:pt-0${drafted ? " ai-draft-row" : ""}`}>
          <div className={`${open ? "mb-3 " : ""}flex items-center justify-between gap-3`}>
            <h3 id={`${rowId}-title`} tabIndex={-1} className="min-w-0 flex-1">
              <button type="button" className="activity-toggle" aria-expanded={open} aria-controls={`${rowId}-body`} onClick={() => toggleRow(rowId)}>
                <svg className="activity-chevron" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="m6 8 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span className="flex-none font-bold">Activity {index + 1}</span>{drafted && <span className="status" data-tone="info">AI draft</span>}
                {!open && <span className="activity-summary">{summary || "Empty activity"}</span>}
              </button>
            </h3>
            <button type="button" className="inline-flex min-h-11 flex-none items-center text-sm font-semibold text-danger-ink underline" onClick={() => { void confirmRemoval(rowId, index, row); }}>Remove</button>
          </div>
          <div id={`${rowId}-body`} hidden={!open}>
          <div className="grid gap-4 sm:grid-cols-2"><label>Project<input maxLength={200} value={row.project} onChange={e => update(index, "project", e.target.value)} /></label><label>Status<select value={row.status} onChange={e => update(index, "status", e.target.value)}><option>Ongoing</option><option>Completed</option></select></label></div>
          <label className="mt-4">Task description<textarea rows={4} maxLength={4000} value={row.task} onChange={e => update(index, "task", e.target.value)} /></label>
          <label className="mt-4">Remarks / blockers<textarea rows={3} maxLength={4000} value={row.remarks} onChange={e => update(index, "remarks", e.target.value)} /></label>
          </div>
        </div>; })}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap gap-3"><button ref={addActivity} type="button" className="secondary-button" disabled={rows.length >= 100} onClick={() => { setRows(current => [...current, { ...empty, project: current.at(-1)?.project ?? "" }]); setIds(current => [...current, newId()]); }}>Add activity</button><button className="primary-button">{pending ? "Saving…" : "Save draft"}</button></div>
          {report?.status === "draft" && !unsaved && <div className="flex w-full flex-wrap items-center gap-3 border-t border-line pt-3 sm:ml-auto sm:w-auto sm:justify-end sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4"><span className="w-full text-xs font-semibold text-muted sm:w-auto">Download saved draft</span><a className="secondary-button" href={`/api/reports/${report.id}/export?format=docx`}>DOCX</a><a className="secondary-button" href={`/api/reports/${report.id}/export?format=pdf`}>PDF</a></div>}
        </div>
        </fieldset>{state.error && <p role="alert" className="notice" data-tone="danger">{state.error}</p>}
        <p className="muted-copy">Save changes before marking Ready. Ready requires completed attendance, your profile, and at least one complete activity.</p>
        {report?.status === "draft" && !unsaved && <p className="muted-copy">Draft downloads use saved activities and completed attendance totals. In-progress attendance is excluded until you save a time out; the preview is not archived.</p>}
      </form> : <div className="record-list mt-6">{report?.rows.map((row, i) => <article key={i} className="record-row min-w-0"><h3 className="break-words font-semibold">{row.project} · {row.status}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm">{row.task}</p>{row.remarks && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted">{row.remarks}</p>}</article>)}</div>}
    </div>
    {report && <div className="panel space-y-5"><h2 className="section-title">Next step</h2>
      {isLatest && report.status === "draft" && (unsaved ? <p className="muted-copy">Save your activity changes before marking Ready.</p> : <Command report={report} command="ready" label="Mark Ready" primary />)}
      {report.status !== "draft" && <><div className="flex flex-wrap gap-3"><a className="primary-button" href={`/api/reports/${report.id}/export?format=docx`}>Download DOCX</a><a className="secondary-button" href={`/api/reports/${report.id}/export?format=pdf`}>Download PDF</a></div><p className="muted-copy">Downloads are archived, optional before marking Submitted, and remain available afterward.</p></>}
      {isLatest && report.status === "ready" && !report.needs_review && <Command report={report} command="submit" label="Mark Submitted" primary />}
      {isLatest && report.status !== "draft" && <Command report={report} command="reopen" label="Create updated version" />}
      {isLatest && report.status === "draft" && <div className="border-t border-line pt-5"><h3 className="font-bold">Cancel this draft</h3><p className="muted-copy mt-1 mb-3">This removes only the current draft. Earlier Ready or Submitted versions stay saved.</p><Command report={report} command="delete" label="Delete draft" danger /></div>}
      <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-accent underline" href={`/attendance?date=${date}`}>Open attendance for this date</Link>
    </div>}
  </section></div>
  <ReportSidebar>
    {sidebar}
    {editable && <ReportImport currentDate={date} editable={editable} currentRows={rows} applyRows={applyImportedRows} />}
  </ReportSidebar>{confirmation}</>;
}
