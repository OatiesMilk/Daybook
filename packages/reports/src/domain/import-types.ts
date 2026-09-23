import type { ActivityRow, Profile } from "./rules";

export type ImportSource = "docx" | "pdf";

export type ImportedActivityRow = {
  project: string;
  task: string;
  status: ActivityRow["status"] | null;
  rawStatus: string;
  remarks: string;
};

export type ImportedReportHeader = {
  full_name: string | null;
  school: string | null;
  department: string | null;
  date: string | null;
  statedMinutes: number | null;
};

export type ParsedReportImport = {
  source: ImportSource;
  header: ImportedReportHeader;
  rows: ImportedActivityRow[];
  warnings: string[];
};

export type ReportImportResult = ParsedReportImport & {
  currentProfile: Profile | null;
  attendanceMinutes: number | null;
  dateError: string;
  targetStatus: "draft" | "ready" | "submitted" | null;
};

export function fillBlankProjects(rows: ImportedActivityRow[]): ImportedActivityRow[] {
  let previous = "";
  return rows.map(row => {
    if (row.project.trim()) { previous = row.project; return row; }
    return previous ? { ...row, project: previous } : row;
  });
}
