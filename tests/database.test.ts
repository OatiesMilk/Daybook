import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { calculateAttendance } from "../packages/attendance/src/domain/index.ts";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const stranger = "33333333-3333-4333-8333-333333333333";

test("migration, exact credits, constraints, and private owner access", async () => {
  const db = new PGlite();
  try {
    // Supabase supplies auth.users, auth.uid(), and these roles in hosted projects.
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema auth, public to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      insert into auth.users values ('${owner}'), ('${other}'), ('${stranger}');
    `);
    await db.exec(await readFile(new URL("../supabase/migrations/202609180001_foundation.sql", import.meta.url), "utf8"));
    await db.exec(`insert into public.allowed_users(user_id) values ('${owner}'), ('${other}');`);
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${owner}';`);

    // Compare database-generated values against the application rules across boundaries.
    for (const [timeIn, timeOut] of [["08:00", "18:30"], ["09:00", "18:30"], ["08:30", "12:00"],
      ["13:00", "19:30"], ["11:30", "12:30"], ["12:30", "13:30"], ["19:00", "20:00"], ["08:31", "18:29"]]) {
      for (const overtime of [false, true]) {
        const expected = calculateAttendance({ date: "2026-09-18", timeIn, timeOut, overtime });
        const result = await db.query<{ regular_minutes: number; overtime_minutes: number }>(`
          insert into public.attendance (user_id, work_date, time_in, time_out, overtime_enabled)
          values ($1, '2026-09-18', $2, $3, $4)
          on conflict (user_id, work_date) do update set
            time_in = excluded.time_in, time_out = excluded.time_out, overtime_enabled = excluded.overtime_enabled
          returning regular_minutes, overtime_minutes`, [owner, timeIn, timeOut, overtime]);
        assert.equal(result.rows[0].regular_minutes, expected.regularMinutes);
        assert.equal(result.rows[0].overtime_minutes, expected.overtimeMinutes);
      }
    }
    await assert.rejects(db.exec(`insert into public.attendance(user_id,work_date,time_in,time_out) values ('${owner}','2026-09-19','08:30','18:30')`));
    await assert.rejects(db.exec(`update public.attendance set time_out = '08:00'`));
    await assert.rejects(db.exec(`update public.attendance set time_in = '08:30:01'`));
    await assert.rejects(db.exec(`update public.attendance set time_out = '24:00'`));
    await assert.rejects(db.exec(`update public.attendance set regular_minutes = 9999`));
    await assert.rejects(db.exec(`insert into public.attendance(user_id,work_date,time_in,time_out) values ('${owner}','2026-09-18','08:30','18:30')`));
    await assert.rejects(db.exec(`insert into public.profiles(user_id,full_name) values ('${other}', 'Forged')`));
    await db.exec(`insert into public.profiles(user_id,full_name) values ('${owner}', 'Owner')`);
    assert.equal((await db.query("select * from public.profiles")).rows.length, 1);

    const summary = await db.query<{ total_minutes: number; recorded_days: number }>("select * from public.attendance_summary('2026-09-18')");
    assert.equal(Number(summary.rows[0].total_minutes), 538);
    assert.equal(Number(summary.rows[0].recorded_days), 1);
    const past = await db.query<{ total_minutes: number }>("select * from public.attendance_summary('2026-09-17')");
    assert.equal(Number(past.rows[0].total_minutes), 0);

    await db.exec(`set request.jwt.claim.sub = '${other}';`);
    assert.equal((await db.query("select * from public.attendance")).rows.length, 0);
    assert.equal((await db.query("select * from public.profiles")).rows.length, 0);
    assert.equal((await db.query("delete from public.attendance returning *")).rows.length, 0);
    assert.equal((await db.query("update public.profiles set full_name = 'Changed' returning *")).rows.length, 0);
    await assert.rejects(db.exec(`insert into public.attendance(user_id,work_date,time_in,time_out) values ('${owner}','2026-09-17','08:30','18:30')`));

    await db.exec(`set request.jwt.claim.sub = '${stranger}';`);
    await assert.rejects(db.exec(`insert into public.allowed_users(user_id) values ('${stranger}')`));
    await assert.rejects(db.exec(`insert into public.attendance(user_id,work_date,time_in,time_out) values ('${stranger}','2026-09-17','08:30','18:30')`));

    await db.exec(`reset role; update public.allowed_users set active = false where user_id = '${owner}'; set role authenticated; set request.jwt.claim.sub = '${owner}';`);
    assert.equal((await db.query("select * from public.attendance")).rows.length, 0);
    await assert.rejects(db.exec(`insert into public.attendance(user_id,work_date,time_in,time_out) values ('${owner}','2026-09-17','08:30','18:30')`));
    await db.exec("reset role; set role anon;");
    await assert.rejects(db.query("select * from public.attendance"));
    await assert.rejects(db.query("select * from public.profiles"));
    await assert.rejects(db.query("select * from public.allowed_users"));
    await assert.rejects(db.query("select * from public.attendance_summary('2026-09-18')"));
  } finally { await db.close(); }
});
