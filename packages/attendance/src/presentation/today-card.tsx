import Link from "next/link";
import type { ReactNode } from "react";
import type { Attendance } from "@dtr/shared/infrastructure/database.types";
import { attendanceState, formatMinutes } from "@dtr/attendance/domain/index";

const longDate = (date: string) => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

type State = { tone: "start" | "progress" | "success" | "warning" | "danger" | "rest"; pill?: "info" | "success" | "warning" | "danger"; label: string; headline: string; detail: string; action: { href: string; text: string; primary: boolean } };

function describe(today: string, workday: boolean, record: Attendance | null): State {
  const edit = `/attendance?date=${today}`;
  if (!workday) return { tone: "rest", label: "Weekend", headline: "No attendance today", detail: "Attendance is for weekdays. You can still review or finish a report.", action: { href: "/reports/all", text: "Browse reports", primary: false } };
  if (!record) return { tone: "start", label: "Not recorded", headline: "Start your day", detail: "Save time in when you begin. You can add time out later.", action: { href: "/attendance", text: "Record time in", primary: true } };
  const kind = attendanceState(record, today);
  if (kind === "absent") return { tone: "danger", pill: "danger", label: "Absent", headline: "Marked absent", detail: "No hours are credited for today.", action: { href: edit, text: "Edit attendance", primary: false } };
  if (kind === "in_progress") return { tone: "progress", pill: "info", label: "In progress", headline: `Timed in at ${record.time_in?.slice(0, 5) ?? "—"}`, detail: "You’re still working. Add time out when you finish to credit today’s hours.", action: { href: edit, text: "Add time out", primary: true } };
  if (kind === "unfinished") return { tone: "warning", pill: "warning", label: "Unfinished", headline: `Timed in at ${record.time_in?.slice(0, 5) ?? "—"}`, detail: "Add time out to credit this day’s hours.", action: { href: edit, text: "Add time out", primary: true } };
  const credited = (record.regular_minutes ?? 0) + (record.overtime_minutes ?? 0);
  return { tone: "success", pill: "success", label: "Worked", headline: `${formatMinutes(credited)} credited`, detail: `${record.time_in?.slice(0, 5) ?? "—"}–${record.time_out?.slice(0, 5) ?? "—"} · ${record.work_location === "home" ? "WFH" : "Office"}`, action: { href: edit, text: "Edit attendance", primary: false } };
}

export function TodayCard({ today, workday, record, children }: { today: string; workday: boolean; record: Attendance | null; children?: ReactNode }) {
  const state = describe(today, workday, record);
  return <section className="panel today-card flex flex-col" data-tone={state.tone} aria-label="Today">
    <p className="text-sm font-semibold text-muted">{longDate(today)}</p>
    <div className="mt-3"><span className="status" data-tone={state.pill}>{state.label}</span></div>
    <h2 className="section-title mt-3 !text-2xl">{state.headline}</h2>
    <p className="muted-copy mt-2">{state.detail}</p>
    {children}
    <div className="mt-auto pt-6"><Link href={state.action.href} className={`${state.action.primary ? "primary-button" : "secondary-button"} w-full sm:w-auto`}>{state.action.text}</Link></div>
  </section>;
}
