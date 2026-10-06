import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { isProfileComplete, NO_CARRY_OVER, parseCarryOver } from "../packages/identity/src/domain/profile.ts";
import { formatShortDate } from "../packages/shared/src/domain/internship-date.ts";

const continuing = { mode: "continuing", hours: "200", minutes: "30", asOf: "2026-09-04", note: "  School DTR  " };

test("carried-over hours are validated before saving", () => {
  assert.deepEqual(parseCarryOver({ ...continuing, mode: "fresh" }, 486, "2026-10-06"), NO_CARRY_OVER);
  assert.deepEqual(parseCarryOver(continuing, 486, "2026-10-06"), { prior_minutes: 12030, prior_hours_as_of: "2026-09-04", prior_hours_note: "School DTR" });
  assert.equal(parseCarryOver({ ...continuing, hours: "486", minutes: "" }, 486, "2026-10-06").prior_minutes, 29160);
  assert.equal(parseCarryOver({ ...continuing, asOf: "2026-10-06" }, 486, "2026-10-06").prior_hours_as_of, "2026-10-06");
  assert.throws(() => parseCarryOver({ ...continuing, mode: "" }, 486, "2026-10-06"), /starting fresh or continuing/);
  assert.throws(() => parseCarryOver({ ...continuing, hours: "-5" }, 486, "2026-10-06"), /whole number/);
  assert.throws(() => parseCarryOver({ ...continuing, hours: "1.5" }, 486, "2026-10-06"), /whole number/);
  assert.throws(() => parseCarryOver({ ...continuing, minutes: "60" }, 486, "2026-10-06"), /0 to 59/);
  assert.throws(() => parseCarryOver({ ...continuing, hours: "0", minutes: "0" }, 486, "2026-10-06"), /Starting fresh/);
  assert.throws(() => parseCarryOver({ ...continuing, hours: "486", minutes: "1" }, 486, "2026-10-06"), /cannot exceed your 486h/);
  assert.throws(() => parseCarryOver({ ...continuing, asOf: "" }, 486, "2026-10-06"), /counted up to/);
  assert.throws(() => parseCarryOver({ ...continuing, asOf: "2026-02-30" }, 486, "2026-10-06"), /counted up to/);
  assert.throws(() => parseCarryOver({ ...continuing, asOf: "2026-10-07" }, 486, "2026-10-06"), /future/);
  assert.throws(() => parseCarryOver({ ...continuing, note: "x".repeat(301) }, 486, "2026-10-06"), /300 characters/);
  // Emoji and non-Latin text are ordinary note content.
  assert.equal(parseCarryOver({ ...continuing, note: "확인됨 ✅" }, 486, "2026-10-06").prior_hours_note, "확인됨 ✅");
});

test("carried-over dates format the same everywhere", () => {
  assert.equal(formatShortDate("2026-09-30"), "Sep 30, 2026");
  assert.equal(formatShortDate("not-a-date"), "not-a-date");
  assert.equal(formatShortDate("2026-13-45"), "2026-13-45");
});

test("onboarding requires every report field and a target", () => {
  const profile = { full_name: "Example Intern", last_name: "Intern", school: "School", department: "IT", target_hours: 486 };
  assert.equal(isProfileComplete(profile), true);
  assert.equal(isProfileComplete(null), false);
  assert.equal(isProfileComplete({ ...profile, school: "  " }), false);
  assert.equal(isProfileComplete({ ...profile, target_hours: null }), false);
});

test("carried-over hours join totals once and block overlapping attendance", async () => {
  const db = new PGlite();
  const owner = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";
  const code = (expected: string) => (error: unknown) => (error as { code?: string }).code === expected;
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,public to authenticated; grant execute on function auth.uid() to authenticated;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(bucket_id text,name text,owner_id text, primary key(bucket_id,name));
      alter table storage.objects enable row level security; grant usage on schema storage to authenticated;
      grant select,insert,update,delete on storage.objects to authenticated;
      insert into auth.users values ('${owner}'),('${other}');`);
    for (const name of ["202609180001_foundation.sql", "202609180002_attendance_workflow.sql", "202609180003_reports.sql", "202609210004_absences.sql", "202609210005_report_submit_owner_id.sql", "202609210006_optional_report_exports.sql", "202609210007_delete_report_drafts.sql", "202609210008_profile_target_hours.sql", "202609280009_open_signup_provisioning.sql", "202610060012_profile_prior_hours.sql"]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));
    }
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${owner}';
      update public.profiles set full_name='Example Intern',last_name='Intern',school='School',department='IT',target_hours=486 where user_id='${owner}';`);
    const summary = async (through = "2020-12-31") => Number((await db.query<{ total_minutes: number }>("select total_minutes from public.attendance_summary($1)", [through])).rows[0].total_minutes);

    // Existing users are unaffected: no balance, totals are attendance-only.
    assert.deepEqual((await db.query("select prior_minutes,prior_hours_as_of,prior_hours_note from public.profiles")).rows, [{ prior_minutes: 0, prior_hours_as_of: null, prior_hours_note: "" }]);
    await db.exec(`insert into public.attendance(user_id,work_date,time_in,time_out) values ('${owner}','2020-09-07','08:30','18:30')`);
    assert.equal(await summary(), 540);

    // A balance cannot cover dates that already have attendance (Sep 7 exists).
    await assert.rejects(db.exec("update public.profiles set prior_minutes=12000,prior_hours_as_of='2020-09-07'"), code("DBC02"));
    await db.exec("update public.profiles set prior_minutes=12000,prior_hours_as_of='2020-09-04',prior_hours_note='School DTR'");
    assert.equal(await summary(), 12540);
    assert.equal(await summary("2020-09-03"), 0, "the balance applies only once its covered period is reached");
    assert.equal(Number((await db.query<{ recorded_days: number }>("select recorded_days from public.attendance_summary('2020-12-31')")).rows[0].recorded_days), 1, "worked days stay attendance-only");

    // Covered dates reject attendance and absences, inserted or moved there.
    await assert.rejects(db.exec(`insert into public.attendance(user_id,work_date,time_in,time_out) values ('${owner}','2020-09-04','08:30','18:30')`), code("DBC01"));
    await assert.rejects(db.exec(`insert into public.attendance(user_id,work_date,time_in,time_out,absent) values ('${owner}','2020-09-03',null,null,true)`), code("DBC01"));
    await assert.rejects(db.exec("update public.attendance set work_date='2020-09-02'"), code("DBC01"));
    await db.exec(`insert into public.attendance(user_id,work_date,time_in,time_out) values ('${owner}','2020-09-08','08:30','12:00')`);
    assert.equal(await summary(), 12750);

    // Constraint and trigger bounds.
    await assert.rejects(db.exec("update public.profiles set prior_hours_as_of='2999-01-01'"), code("23514"));
    await assert.rejects(db.exec("update public.profiles set prior_minutes=486*60+1"), code("23514"));
    await assert.rejects(db.exec("update public.profiles set prior_minutes=-1"), code("23514"));
    await assert.rejects(db.exec("update public.profiles set prior_hours_as_of=null"), code("23514"));
    await assert.rejects(db.exec("update public.profiles set target_hours=100"), code("23514"), "the target cannot drop below the balance");
    await assert.rejects(db.exec("update public.profiles set prior_hours_note=repeat('x',301)"), code("23514"));

    // Ready snapshots include the balance; changing it flags frozen reports for review.
    const rows = JSON.stringify([{ project: "Portal", task: "Built tracker", status: "Completed", remarks: "" }]);
    const id = (await db.query<{ id: string }>("select public.report_command('save','2020-09-07',null,null,$1::jsonb) as id", [rows])).rows[0].id;
    const version = (await db.query<{ updated_at: string }>("select updated_at from public.reports where id=$1", [id])).rows[0].updated_at;
    await db.query("select public.report_command('ready','2020-09-07',$1,$2,$3::jsonb)", [id, version, rows]);
    const ready = (await db.query<{ snapshot: { totalMinutes: number }; needs_review: boolean }>("select snapshot,needs_review from public.reports where id=$1", [id])).rows[0];
    assert.equal(Number(ready.snapshot.totalMinutes), 12540, "Sep 7 total = 200h carried over + 9h attendance");
    assert.equal(ready.needs_review, false);
    await db.exec("update public.profiles set full_name='Renamed Intern'");
    assert.equal((await db.query<{ needs_review: boolean }>("select needs_review from public.reports where id=$1", [id])).rows[0].needs_review, false, "unrelated edits do not flag reports");
    await db.exec("update public.profiles set prior_minutes=11000");
    assert.equal((await db.query<{ needs_review: boolean }>("select needs_review from public.reports where id=$1", [id])).rows[0].needs_review, true);

    // Starting fresh clears the balance and reopens the covered dates.
    await db.exec("update public.profiles set prior_minutes=0,prior_hours_as_of=null");
    await db.exec(`insert into public.attendance(user_id,work_date,time_in,time_out,absent) values ('${owner}','2020-09-03',null,null,true)`);

    // Another student can neither see nor change this balance.
    await db.exec(`update public.profiles set prior_minutes=12000,prior_hours_as_of='2020-09-02';
      set request.jwt.claim.sub='${other}';`);
    assert.equal((await db.query("select * from public.profiles where user_id=$1", [owner])).rows.length, 0);
    // Writing rows with the owner's ID must fail on RLS (42501) without the validation
    // triggers revealing the owner's covered-through date or attendance dates.
    await assert.rejects(db.exec(`insert into public.attendance(user_id,work_date,time_in,time_out) values ('${owner}','2020-09-01','08:30','18:30')`), code("42501"));
    await assert.rejects(db.exec(`insert into public.profiles(user_id,prior_minutes,prior_hours_as_of,target_hours) values ('${owner}',60,'2020-09-30',486)`), code("42501"));
    assert.equal((await db.query(`update public.profiles set prior_minutes=0,prior_hours_as_of=null where user_id='${owner}' returning *`)).rows.length, 0);
    assert.equal(await summary(), 0);
    await db.exec(`set request.jwt.claim.sub='${owner}'`);
    assert.equal(Number((await db.query<{ prior_minutes: number }>("select prior_minutes from public.profiles")).rows[0].prior_minutes), 12000);
  } finally { await db.close(); }
});
