import { test } from "node:test";
import assert from "node:assert/strict";
import { attendanceReminders, completionEstimate, internshipClockMinutes, reminderWindow } from "../packages/attendance/src/domain/index.ts";
import { activeReminders, defaultReminderPreferences, parseReminderPreferences } from "../packages/attendance/src/domain/reminder-preferences.ts";

test("reminder badge excludes disabled and dismissed items and tolerates corrupt browser preferences", () => {
  const reminders = attendanceReminders([{ ...worked("2026-09-25"), time_out: null }, worked("2026-09-24")], new Map([["2026-09-25", { status: "submitted", needs_review: false }]]), "2026-09-28", 1200);
  assert.equal(activeReminders(reminders, defaultReminderPreferences).length, 2);
  assert.equal(activeReminders(reminders, parseReminderPreferences('{"time_out":false}')).length, 1);
  assert.equal(activeReminders(reminders, parseReminderPreferences('{"dismissed":["report:2026-09-24:missing",5,null]}')).length, 1);
  assert.equal(activeReminders(reminders, parseReminderPreferences('{"time_out":false,"report":false}')).length, 0);
  for (const value of ["null", "bad", "{}", "[]"]) assert.deepEqual(parseReminderPreferences(value), defaultReminderPreferences);
});

const worked = (date: string, minutes = 540) => ({ work_date: date, absent: false, time_out: "18:30:00", regular_minutes: minutes, overtime_minutes: 0 });

test("completion estimate uses recent completed days, exact minutes, and future weekdays", () => {
  assert.equal(completionEstimate("2026-09-25", 540, 18, [worked("2026-09-25")])?.date, "2026-09-28");
  assert.equal(completionEstimate("2026-09-26", 540, 18, [worked("2026-09-25")])?.date, "2026-09-28");
  assert.equal(completionEstimate("2026-09-27", 540, 54, [worked("2026-09-25")])?.date, "2026-10-02");
  assert.equal(completionEstimate("2026-09-25", 540, 54, [worked("2026-09-25")])?.date, "2026-10-02");
  assert.equal(completionEstimate("2026-12-31", 540, 18, [worked("2026-12-31")])?.date, "2027-01-01");
  assert.equal(completionEstimate("2026-09-28", 541, 18, [worked("2026-09-28", 539)])?.daysLeft, 1);
  assert.equal(completionEstimate("2026-09-28", 0, 18, []) , null);
  assert.equal(completionEstimate("2026-09-28", 0, 18, [worked("2026-09-28", 0)]), null);
  assert.equal(completionEstimate("2026-09-28", 1081, 18, [])?.complete, true);
  assert.equal(completionEstimate("2026-09-28", 0, 18, [{ ...worked("2026-09-28"), absent: true }, { ...worked("2026-09-28"), time_out: null }, worked("2026-09-29")]), null);
  const recent = Array.from({ length: 11 }, (_, index) => worked(`2026-09-${String(index + 1).padStart(2, "0")}`, index === 0 ? 1 : 600));
  assert.equal(completionEstimate("2026-09-28", 0, 100, recent)?.averageMinutes, 600);
  assert.equal(completionEstimate("2026-09-28", 0, 100, recent)?.sampleDays, 10);
  assert.equal(completionEstimate("2026-09-28", 0, 10000, recent.slice(1).map((day, index) => ({ ...day, regular_minutes: index === 0 ? 1 : 0 })))?.date, null);
});

test("reminders exclude absences, submitted reports, future and old records; today's open entry waits until 18:20 Manila", () => {
  const today = "2026-09-28";
  const entries = [
    { ...worked(today), time_out: null }, { ...worked("2026-09-25"), time_out: null },
    worked("2026-09-24"), worked("2026-09-23"), { ...worked("2026-09-22"), absent: true },
    worked("2026-08-28"), worked("2026-09-29"),
  ];
  const reports = new Map([["2026-09-23", { status: "submitted" as const, needs_review: false }]]);
  assert.deepEqual(attendanceReminders(entries, reports, today, 1099).map(item => item.id), ["time_out:2026-09-25", "report:2026-09-25:missing", "report:2026-09-24:missing"]);
  assert.deepEqual(attendanceReminders(entries, reports, today, 1100).slice(0, 2).map(item => item.id), ["time_out:2026-09-28", "report:2026-09-28:missing"]);
  assert.equal(reminderWindow(today), "2026-08-30");
  assert.equal(internshipClockMinutes(new Date("2026-09-28T10:20:00Z")), 1100);
  assert.equal(internshipClockMinutes(new Date("2026-09-27T16:00:00Z")), 0);
  assert.equal(attendanceReminders([worked(today)], new Map([[today, { status: "submitted", needs_review: false }]]), today, 1200).length, 0);
  assert.equal(attendanceReminders([], new Map(), today, 1200).length, 0);
});

test("DAR reminders follow draft, ready, submitted and needs-review states without changing records", () => {
  const today = "2026-09-28";
  const open = { ...worked(today), time_out: null };
  assert.equal(attendanceReminders([open], new Map(), today, 1099).length, 0);
  for (const status of ["draft", "ready", "submitted"] as const) {
    const reports = new Map([[today, { status, needs_review: false }]]);
    const reminders = attendanceReminders([open], reports, today, 1100);
    assert.equal(reminders.filter(item => item.kind === "report").length, status === "submitted" ? 0 : 1);
    if (status === "ready") assert.equal(reminders[1]?.title, "Submit your DAR");
    assert.equal(reports.get(today)?.status, status);
  }
  const review = attendanceReminders([worked(today)], new Map([[today, { status: "submitted", needs_review: true }]]), today, 1100);
  assert.equal(review[0]?.title, "Review your DAR");
  assert.equal(review[0]?.id, `report:${today}:review`);
});
