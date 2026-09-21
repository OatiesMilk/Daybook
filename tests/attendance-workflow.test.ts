import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAttendanceForm, validateAttendance, viberMessage } from "../src/models/attendance-rules.ts";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

test("open attendance, future-date validation and Viber text", () => {
  const entry = { work_date: "2026-09-18", time_in: "13:00", time_out: null, work_location: "home" as const, overtime_enabled: true, absent: false };
  assert.equal(validateAttendance(entry, "2026-09-18").time_out, null);
  assert.throws(() => validateAttendance(entry, "2026-09-17"), /future/);
  assert.throws(() => validateAttendance({ ...entry, time_out: "12:00" }, "2026-09-18"), /after/);
  assert.equal(viberMessage("08:30:00", "login"), "@office login 8:30am");
  assert.equal(viberMessage("18:30", "logout"), "@office logout 6:30pm");
  assert.equal(viberMessage("12:00", "login"), "@office login 12:00pm");
  const absent = { ...entry, time_in: null, time_out: null, overtime_enabled: false, absent: true };
  assert.deepEqual(validateAttendance(absent, "2026-09-18"), absent);
  assert.throws(() => validateAttendance({ ...absent, time_in: "08:30" }, "2026-09-18"), /Absent/);
  assert.throws(() => validateAttendance({ ...absent, absent: false }, "2026-09-18"), /time in/);
});

test("absence form saves no times and attended form keeps the selected time out", () => {
  const absence = new FormData();
  absence.set("work_date", "2020-09-17"); absence.set("work_location", "office"); absence.set("absent", "on");
  assert.deepEqual(parseAttendanceForm(absence), {
    work_date: "2020-09-17", time_in: null, time_out: null,
    work_location: "office", overtime_enabled: false, absent: true,
  });
  absence.delete("absent"); absence.set("time_in", "08:30"); absence.set("time_out", "18:30");
  assert.equal(parseAttendanceForm(absence).time_out, "18:30");
});

test("upgrade preserves credit, supports open entries and rejects future dates and duplicate days", async () => {
  const db = new PGlite();
  try {
    const id = "11111111-1111-4111-8111-111111111111";
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select '${id}'::uuid $$; insert into auth.users values ('${id}');`);
    for (const file of ["202609180001_foundation.sql", "202609180002_attendance_workflow.sql"]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
    }
    await db.exec(`insert into public.allowed_users(user_id) values ('${id}');
      insert into public.attendance(user_id,work_date,time_in,time_out) values ('${id}','2020-09-17','08:30',null);`);
    const open = await db.query("select regular_minutes, overtime_minutes from public.attendance");
    assert.deepEqual(open.rows[0], { regular_minutes: null, overtime_minutes: null });
    let summary = await db.query<{ total_minutes: number; recorded_days: number }>("select * from public.attendance_summary('2020-09-18')");
    assert.equal(Number(summary.rows[0].total_minutes), 0); assert.equal(Number(summary.rows[0].recorded_days), 0);
    await db.exec("update public.attendance set time_out = '18:30'");
    summary = await db.query("select * from public.attendance_summary('2020-09-18')");
    assert.equal(Number(summary.rows[0].total_minutes), 540); assert.equal(Number(summary.rows[0].recorded_days), 1);
    await assert.rejects(db.exec(`insert into public.attendance(user_id,work_date,time_in) values ('${id}','2099-01-05','08:30')`));
    await assert.rejects(db.exec(`insert into public.attendance(user_id,work_date,time_in) values ('${id}','2020-09-17','08:30')`));
    await db.exec("update public.attendance set work_date='2020-09-18'");
    assert.equal((await db.query("select work_date from public.attendance")).rows.length, 1);
  } finally { await db.close(); }
});

test("absence migration preserves worked records and excludes absences from hours and days", async () => {
  const db = new PGlite();
  const id = "11111111-1111-4111-8111-111111111111";
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select '${id}'::uuid $$;
      insert into auth.users values ('${id}');`);
    for (const file of ["202609180001_foundation.sql", "202609180002_attendance_workflow.sql", "202609210004_absences.sql"]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
    }
    await db.exec(`insert into public.allowed_users(user_id) values ('${id}');
      insert into public.attendance(user_id,work_date,time_in,time_out) values ('${id}','2020-09-16','08:30','18:30');
      insert into public.attendance(user_id,work_date,time_in,time_out,absent) values ('${id}','2020-09-17',null,null,true);`);
    const rows = await db.query<{ absent: boolean; regular_minutes: number | null }>("select absent, regular_minutes from public.attendance order by work_date");
    assert.deepEqual(rows.rows, [{ absent: false, regular_minutes: 540 }, { absent: true, regular_minutes: null }]);
    const summary = await db.query<{ total_minutes: number; recorded_days: number }>("select * from public.attendance_summary('2020-09-18')");
    assert.equal(Number(summary.rows[0].total_minutes), 540);
    assert.equal(Number(summary.rows[0].recorded_days), 1);
    await assert.rejects(db.exec(`insert into public.attendance(user_id,work_date,time_in,time_out,absent) values ('${id}','2020-09-18','08:30',null,true)`));
    await assert.rejects(db.exec(`update public.attendance set absent=false where work_date='2020-09-17'`));
    await db.exec("update public.attendance set absent=false,time_in='13:00',time_out='18:30' where work_date='2020-09-17'");
    const updated = await db.query<{ total_minutes: number; recorded_days: number }>("select * from public.attendance_summary('2020-09-18')");
    assert.equal(Number(updated.rows[0].total_minutes), 870);
    assert.equal(Number(updated.rows[0].recorded_days), 2);
  } finally { await db.close(); }
});
