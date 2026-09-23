"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { importProfileAction } from "@dtr/identity/application/profile-actions";
import { fillBlankProjects } from "@dtr/reports/domain/import-types";
import { validateRows, type ActivityRow } from "@dtr/reports/domain/rules";
import type { ImportedActivityRow, ReportImportResult } from "@dtr/reports/domain/import-types";
import { formatMinutes } from "@dtr/attendance/domain/index";

const PENDING_IMPORT_KEY = "daybook.pending-report-import";
const PENDING_IMPORT_TTL = 10 * 60 * 1000;

function meaningful(rows: ActivityRow[]) {
  return rows.some(row => row.project.trim() || row.task.trim() || row.remarks.trim());
}

function profileDifferences(result: ReportImportResult) {
  const current = result.currentProfile;
  const fields = [
    ["full_name", "Name", result.header.full_name, current?.full_name ?? ""],
    ["school", "School", result.header.school, current?.school ?? ""],
    ["department", "Department / team", result.header.department, current?.department ?? ""],
  ] as const;
  return fields.filter(([, , imported, saved]) => imported && imported.normalize("NFKC").trim() !== saved.normalize("NFKC").trim());
}

function ImportedProfileForm({ result }: { result: ReportImportResult }) {
  const differences = profileDifferences(result);
  const [state, action, pending] = useActionState(importProfileAction, { error: "" });
  if (!differences.length) return <p className="notice" data-tone="success">The imported profile fields match your saved profile.</p>;
  return <form action={action} className="notice space-y-3" data-tone="warning">
    <p className="font-semibold">Profile differences</p>
    <p className="text-xs">Select fields to update. This is a separate save action and will not change existing report snapshots.</p>
    {differences.map(([key, label, imported, saved]) => <div key={key} className="rounded-md border border-line p-3">
      <p className="text-xs"><span className="font-semibold">Saved:</span> {saved || "Not set"}</p>
      <label className="checkbox-option mt-2"><input type="checkbox" name="fields" value={key} /><span>Use imported {label.toLocaleLowerCase()}: {imported}</span></label>
      <input type="hidden" name={key} value={imported ?? ""} />
    </div>)}
    {state.error && <p role="alert" className="text-sm font-semibold">{state.error}</p>}
    {state.success && <p role="status" className="text-sm font-semibold">{state.success}</p>}
    <button className="secondary-button" disabled={pending}>{pending ? "Updating…" : "Update selected profile fields"}</button>
  </form>;
}

export function ReportImport({ currentDate, editable, currentRows, applyRows }: {
  currentDate: string;
  editable: boolean;
  currentRows: ActivityRow[];
  applyRows: (rows: ActivityRow[]) => boolean;
}) {
  const inputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [result, setResult] = useState<ReportImportResult | null>(null);
  const [rows, setRows] = useState<ImportedActivityRow[]>([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem(PENDING_IMPORT_KEY);
    if (!raw) return;
    sessionStorage.removeItem(PENDING_IMPORT_KEY);
    try {
      const pending = JSON.parse(raw) as { date: string; rows: ActivityRow[]; createdAt: number };
      if (pending.date !== currentDate || Date.now() - pending.createdAt > PENDING_IMPORT_TTL || !editable) return;
      const pendingRows = validateRows(pending.rows);
      if (meaningful(currentRows) && !window.confirm("Replace the activity rows currently in this draft with the imported rows? Unsaved editor changes will be lost.")) return;
      applyRows(pendingRows);
    } catch { queueMicrotask(() => setError("The pending import could not be applied. Upload the report again.")); }
  }, [applyRows, currentDate, currentRows, editable]);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setUploading(true); setError(""); setResult(null); setRows([]);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/reports/import", { method: "POST", body: form, headers: { Accept: "application/json" } });
      const body = await response.json() as ReportImportResult | { error?: string };
      if (!response.ok || !("source" in body)) throw new Error("error" in body && body.error ? body.error : "The report could not be imported.");
      setResult(body); setRows(body.rows);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The report could not be imported."); }
    finally { setUploading(false); }
  }

  function clearImport() {
    if (fileInput.current) fileInput.current.value = "";
    setSelectedFile("");
    setResult(null);
    setRows([]);
    setError("");
  }

  function usableRows(): ActivityRow[] | null {
    if (rows.some(row => row.status === null)) { setError("Choose Completed or Ongoing for every activity before applying the rows."); return null; }
    try { return validateRows(rows.map(row => ({ project: row.project, task: row.task, status: row.status!, remarks: row.remarks }))); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Review the imported activity fields."); return null; }
  }

  function applyImportedRows() {
    if (!result) return;
    const candidate = usableRows(); if (!candidate) return;
    const targetDate = result.header.date && !result.dateError ? result.header.date : currentDate;
    if (targetDate === currentDate) {
      if (!editable) { setError("This report version cannot be edited. Create an updated version before importing rows."); return; }
      if (meaningful(currentRows) && !window.confirm("Replace the activity rows currently in the editor with the imported rows? Unsaved editor changes will be lost.")) return;
      applyRows(candidate); setError("");
      return;
    }
    if (result.targetStatus === "ready" || result.targetStatus === "submitted") {
      setError(`The ${targetDate} report is ${result.targetStatus}. Open it and create an updated version before importing rows.`); return;
    }
    sessionStorage.setItem(PENDING_IMPORT_KEY, JSON.stringify({ date: targetDate, rows: candidate, createdAt: Date.now() }));
    router.push(`/reports?date=${encodeURIComponent(targetDate)}`);
  }

  const blankProjects = rows.filter(row => !row.project.trim()).length;
  const hoursMatch = result && result.header.statedMinutes !== null && result.attendanceMinutes !== null
    ? result.header.statedMinutes === result.attendanceMinutes : null;

  return <section className="rounded-lg border border-line bg-soft p-4" aria-labelledby={`${inputId}-title`}>
    <h3 id={`${inputId}-title`} className="font-bold">Import from file</h3>
    <p className="muted-copy mt-1">Upload a DOCX or PDF to review extracted details. Nothing is saved automatically.</p>
    <form onSubmit={upload} className="mt-4 flex flex-wrap items-end gap-3">
      <label className="w-full max-w-md" htmlFor={inputId}>Daily Activity Report
        <input ref={fileInput} id={inputId} name="report" type="file" accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required
          onChange={event => { setSelectedFile(event.target.files?.[0]?.name ?? ""); setResult(null); setRows([]); setError(""); }} />
      </label>
      <button className="secondary-button" disabled={uploading}>{uploading ? "Reading file…" : "Review import"}</button>
      {(selectedFile || result) && <button type="button" className="secondary-button danger-button" disabled={uploading} onClick={clearImport}>Remove file</button>}
    </form>
    {error && <p role="alert" className="notice mt-4" data-tone="danger">{error}</p>}
    {result && <div className="mt-5 space-y-4">
      <div className="notice">
        <p className="font-semibold">Extracted {result.source.toUpperCase()} details</p>
        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="font-semibold">Name</dt><dd>{result.header.full_name ?? "Not found"}</dd></div>
          <div><dt className="font-semibold">Date</dt><dd>{result.header.date ?? "Not found"}</dd></div>
          <div><dt className="font-semibold">School</dt><dd>{result.header.school ?? "Not found"}</dd></div>
          <div><dt className="font-semibold">Department / team</dt><dd>{result.header.department ?? "Not found"}</dd></div>
        </dl>
      </div>
      {result.warnings.map(warning => <p key={warning} className="notice" data-tone="warning">{warning}</p>)}
      {result.dateError && <p className="notice" data-tone="warning">Imported date: {result.dateError} Activity rows can still be applied to the currently open date.</p>}
      {result.header.date && !result.dateError && result.header.date !== currentDate && <button type="button" className="secondary-button" onClick={() => router.push(`/reports?date=${encodeURIComponent(result.header.date!)}`)}>Open report for {result.header.date}</button>}
      {result.header.statedMinutes !== null && result.attendanceMinutes !== null && <p className="notice" data-tone={hoursMatch ? "success" : "warning"}>
        {hoursMatch ? `The document and attendance records both show ${formatMinutes(result.attendanceMinutes)} through this date.`
          : `This document says ${formatMinutes(result.header.statedMinutes)} through this date; your attendance records currently total ${formatMinutes(result.attendanceMinutes)}. Review attendance before marking Ready.`}
      </p>}
      {result.header.statedMinutes !== null && result.attendanceMinutes === null && <p className="notice" data-tone="warning">The document states {formatMinutes(result.header.statedMinutes)}, but it could not be compared until a valid report date is available. Imported hours will not be saved.</p>}
      <ImportedProfileForm result={result} />
      {!!rows.length && <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="font-semibold">{rows.length} extracted {rows.length === 1 ? "activity" : "activities"}</p>
          {blankProjects > 0 && <button type="button" className="secondary-button" onClick={() => setRows(current => fillBlankProjects(current))}>Fill blank projects from previous row</button>}
        </div>
        <div className="record-list rounded-lg border border-line bg-surface p-4">{rows.map((row, index) => <article className="record-row" key={index}>
          <p className="font-semibold">{row.project || <span className="text-warning-ink">Project is blank</span>}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{row.task || <span className="text-warning-ink">Task is blank</span>}</p>
          <label className="mt-3 max-w-48">Status<select value={row.status ?? ""} onChange={event => setRows(current => current.map((item, i) => i === index ? { ...item, status: event.target.value as ActivityRow["status"], rawStatus: event.target.value } : item))}>
            <option value="" disabled>Review required</option><option value="Ongoing">Ongoing</option><option value="Completed">Completed</option>
          </select></label>
          {row.remarks && <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{row.remarks}</p>}
        </article>)}</div>
        <button type="button" className="primary-button" onClick={applyImportedRows}>{result.header.date && !result.dateError && result.header.date !== currentDate ? `Use date ${result.header.date} and activity rows` : "Replace editor rows"}</button>
        <p className="muted-copy">This only fills the editor. Review the activities, then use Save draft when you are ready.</p>
      </div>}
    </div>}
  </section>;
}
