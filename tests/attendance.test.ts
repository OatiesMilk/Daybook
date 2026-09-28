import { test } from "node:test";
import assert from "node:assert/strict";
import { attendanceState, calendarCredit, calendarSummary, calculateAttendance, internshipToday, isWorkday, pace, parseTime } from "../packages/attendance/src/domain/index.ts";

const credit = (timeIn: string, timeOut: string, overtime = false, date = "2026-09-18") =>
  calculateAttendance({ date, timeIn, timeOut, overtime });

test("calendar summary counts completed attendance, excludes open entries, and detects missing reports", () => {
  const worked = { work_date: "2026-09-21", absent: false, time_out: "19:30:00", regular_minutes: 540, overtime_minutes: 60 };
  const open = { ...worked, work_date: "2026-09-22", time_out: null };
  const absent = { ...worked, work_date: "2026-09-23", absent: true, time_out: null };
  const zero = { ...worked, work_date: "2026-09-24", regular_minutes: 0, overtime_minutes: 0 };
  assert.equal(calendarCredit(worked), 600);
  assert.equal(calendarCredit(open), null);
  assert.equal(calendarCredit(absent), 0);
  assert.deepEqual(calendarSummary([worked, open, absent, zero], new Set([worked.work_date])), {
    minutes: 600, workedDays: 2, absences: 1, missingReports: 1,
  });
  assert.deepEqual(calendarSummary([], new Set()), { minutes: 0, workedDays: 0, absences: 0, missingReports: 0 });
  assert.equal(calendarSummary([worked], new Set(["2026-09-25"])).missingReports, 1);
});

test("full day, early login, late arrival, and half-days", () => {
  assert.equal(credit("08:30", "18:30").totalMinutes, 540);
  assert.equal(credit("08:00", "18:30").totalMinutes, 540);
  assert.equal(credit("09:00", "18:30").totalMinutes, 510);
  assert.equal(credit("08:30", "12:00").totalMinutes, 210);
  assert.equal(credit("13:00", "18:30").totalMinutes, 330);
});
test("subtract only the lunch overlap", () => {
  assert.equal(credit("11:30", "12:30").totalMinutes, 30);
  assert.equal(credit("12:30", "13:30").totalMinutes, 30);
  assert.equal(credit("12:00", "13:00").totalMinutes, 0);
  assert.equal(credit("07:00", "08:00").totalMinutes, 0);
});
test("overtime follows the clock, not a nine-hour threshold", () => {
  assert.deepEqual(credit("13:00", "19:30", true), {
    regularMinutes: 330, overtimeMinutes: 60, totalMinutes: 390,
  });
  assert.equal(credit("13:00", "19:30").totalMinutes, 330);
  assert.equal(credit("19:00", "20:00", true).overtimeMinutes, 60);
  assert.equal(credit("08:30", "19:30", true).totalMinutes, 600);
});
test("preserves minutes and rejects invalid or overnight records", () => {
  assert.equal(credit("08:31", "18:29").totalMinutes, 538);
  for (const time of ["24:00", "8:30", "12:60", "", "09:00:30"]) assert.throws(() => parseTime(time));
  assert.throws(() => credit("18:30", "08:30"));
  assert.throws(() => credit("08:30", "08:30"));
  for (const date of ["2026-09-19", "2026-09-20", "2026-02-30", "bad"]) {
    assert.throws(() => credit("08:30", "18:30", false, date));
  }
});
test("internship date is independent of device timezone", () => {
  assert.equal(internshipToday(new Date("2026-09-17T17:00:00Z")), "2026-09-18");
});

test("workday check and pace projection for the dashboard", () => {
  assert.equal(isWorkday("2026-09-21"), true);
  assert.equal(isWorkday("2026-09-19"), false);
  assert.equal(isWorkday("not-a-date"), false);
  assert.equal(pace(0, 0, 6000), null);
  assert.deepEqual(pace(3000, 6, 6000), { averageMinutes: 500, daysLeft: 6 });
  assert.equal(pace(29160, 50, 29160)?.daysLeft, 0);
});

test("open attendance is in progress today and unfinished on earlier days", () => {
  const open = { absent: false, time_out: null };
  assert.equal(attendanceState({ ...open, work_date: "2026-09-21" }, "2026-09-21"), "in_progress");
  assert.equal(attendanceState({ ...open, work_date: "2026-09-18" }, "2026-09-21"), "unfinished");
  assert.equal(attendanceState({ absent: false, time_out: "18:30:00", work_date: "2026-09-21" }, "2026-09-21"), "worked");
  assert.equal(attendanceState({ absent: true, time_out: null, work_date: "2026-09-21" }, "2026-09-21"), "absent");
});
