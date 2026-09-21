export type ActivityRow = { project: string; task: string; status: "Completed" | "Ongoing"; remarks: string };
export type Profile = { full_name: string; last_name: string; school: string; department: string };
export type ReportSnapshot = { profile: Profile; date: string; totalMinutes: number; rows: ActivityRow[] };
export type Report = { id: string; user_id: string; report_date: string; revision: number; status: "draft" | "ready" | "submitted"; rows: ActivityRow[]; snapshot: ReportSnapshot | null; needs_review: boolean; submitted_at: string | null; created_at: string; updated_at: string };

/** Turns an untrusted ?page= value into a safe 1-based page number. */
export function parsePage(value?: string): number {
  return Math.max(1, Math.min(10000, Number.parseInt(value ?? "1", 10) || 1));
}

export function validateRows(value: unknown): ActivityRow[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error("Use at most 100 activity rows.");
  return value.map(row => {
    if (!row || typeof row !== "object" || typeof row.project !== "string" || row.project.length > 200 || typeof row.task !== "string" || row.task.length > 4000 || typeof row.remarks !== "string" || row.remarks.length > 4000 || !["Completed", "Ongoing"].includes(row.status)) throw new Error("Check your activity fields and status.");
    return { project: row.project.trim(), task: row.task.trim(), status: row.status, remarks: row.remarks.trim() };
  });
}

export function reportFilename(lastName: string, date: string, format: "docx" | "pdf") {
  const surname = lastName.trim().normalize("NFKC").replace(/[^\p{L}\p{N}_-]+/gu, "_").replace(/^_+|_+$/g, "").toUpperCase();
  if (!surname || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Set a valid last name and report date.");
  return `DAR_${surname}_${date.slice(5, 7)}${date.slice(8, 10)}${date.slice(2, 4)}.${format}`;
}
