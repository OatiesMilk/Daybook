import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import PizZip from "pizzip";
import { renderDar } from "../src/models/docx-renderer.ts";
import { parsePage, reportFilename, validateRows } from "../src/models/report-rules.ts";

test("universal filenames, safe rows, and sample-based DOCX layout", async () => {
  assert.equal(reportFilename("Akia", "2026-09-17", "docx"), "DAR_AKIA_091726.docx");
  assert.equal(reportFilename("De la Cruz", "2026-01-02", "pdf"), "DAR_DE_LA_CRUZ_010226.pdf");
  assert.throws(() => reportFilename("../", "2026-01-02", "docx"));
  assert.throws(() => validateRows([{ project: "P", task: "T", status: "Invalid", remarks: "" }]));
  const template = await readFile(new URL("../templates/dar-template.docx", import.meta.url));
  const rows = Array.from({ length: 12 }, (_, i) => ({ project: `Project ${i}`, task: "Task & <safe>\nSecond line", status: "Completed" as const, remarks: "No blockers" }));
  const buffer = renderDar(template, { profile: { full_name: "Example Intern", last_name: "Intern", school: "Example School", department: "IT" }, date: "2026-09-17", totalMinutes: 3750, rows });
  const original = new PizZip(template); const result = new PizZip(buffer);
  const xml = result.file("word/document.xml")!.asText();
  assert.match(xml, /62 hours and 30 mins/); assert.match(xml, /09\/17\/2026/);
  assert.match(xml, /Task &amp; &lt;safe&gt;/); assert.match(xml, /Project 11/);
  assert.doesNotMatch(xml, /Dylan|Akia|Microgenesis|\{#activities\}/);
  assert.match(xml, /w:orient="landscape"/);
  assert.equal((xml.match(/<w:tr>/g) ?? []).length, 16);
  for (const name of Object.keys(original.files).filter(n => n.startsWith("word/media/") || n === "word/header1.xml")) {
    assert.deepEqual(result.file(name)!.asUint8Array(), original.file(name)!.asUint8Array());
  }
});

test("report state machine, immutable snapshots, archived files, and owner access", async () => {
  const db = new PGlite();
  const owner = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,public to authenticated; grant execute on function auth.uid() to authenticated;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(bucket_id text,name text,owner_id text, primary key(bucket_id,name));
      alter table storage.objects enable row level security; grant usage on schema storage to authenticated;
      grant select,insert,update,delete on storage.objects to authenticated;
      insert into auth.users values ('${owner}'),('${other}');`);
    for (const name of ["202609180001_foundation.sql", "202609180002_attendance_workflow.sql", "202609180003_reports.sql", "202609210004_absences.sql", "202609210005_report_submit_owner_id.sql", "202609210006_optional_report_exports.sql"]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));
    }
    await db.exec(`insert into public.allowed_users(user_id) values ('${owner}'),('${other}'); set role authenticated; set request.jwt.claim.sub='${owner}';`);
    const rows = [{ project: "Portal", task: "Built tracker", status: "Completed", remarks: "" }];
    const call = async (command: string, id?: string, version?: string) => {
      const result = await db.query<{ id: string }>("select public.report_command($1,'2020-09-17',$2,$3,$4::jsonb) as id", [command, id ?? null, version ?? null, JSON.stringify(rows)]);
      return result.rows[0].id;
    };
    const load = async (id: string) => (await db.query<{ updated_at: string; status: string; snapshot: { totalMinutes: number }; needs_review: boolean }>("select * from public.reports where id=$1", [id])).rows[0];
    const id = await call("save"); let report = await load(id);
    await assert.rejects(call("ready", id, report.updated_at), /Complete attendance/);
    await db.exec(`insert into public.attendance(user_id,work_date,time_in,time_out,absent) values ('${owner}','2020-09-17',null,null,true);`);
    await assert.rejects(call("ready", id, report.updated_at), /Complete attendance/);
    await db.exec("update public.attendance set absent=false,time_in='08:30',time_out='18:30'");
    await assert.rejects(call("ready", id, report.updated_at), /profile/);
    await db.exec(`insert into public.profiles(user_id,full_name,last_name,school,department) values ('${owner}','Example Intern','Intern','School','IT');`);
    await call("ready", id, report.updated_at); report = await load(id);
    assert.equal(report.status, "ready"); assert.equal(Number(report.snapshot.totalMinutes), 540);
    await assert.rejects(call("save", id, report.updated_at), /Reopen/);
    await assert.rejects(db.exec("update public.reports set status='submitted'"));
    await call("submit", id, report.updated_at); report = await load(id);
    assert.equal(report.status, "submitted");
    assert.equal((await db.query("select * from storage.objects")).rows.length, 0);
    await db.exec(`insert into storage.objects(bucket_id,name) values ('dar-exports','${owner}/${id}/report.docx'),('dar-exports','${owner}/${id}/report.pdf');`);
    assert.equal((await db.query("delete from storage.objects returning *")).rows.length, 0);
    assert.equal((await db.query("update storage.objects set name='changed' returning *")).rows.length, 0);
    await db.exec("update public.attendance set time_out='17:30'"); report = await load(id);
    assert.equal(report.needs_review, true); assert.equal(Number(report.snapshot.totalMinutes), 540);
    const reopened = await call("reopen", id, report.updated_at); let next = await load(reopened);
    assert.equal(next.status, "draft"); assert.equal((await load(id)).status, "submitted");
    await assert.rejects(call("reopen", id, report.updated_at), /latest revision/);
    await call("ready", reopened, next.updated_at); next = await load(reopened);
    assert.equal(Number(next.snapshot.totalMinutes), 480);
    await db.exec("update public.attendance set time_out='16:30'"); next = await load(reopened);
    await assert.rejects(call("submit", reopened, next.updated_at), /current Ready/);
    await db.exec(`set request.jwt.claim.sub='${other}';`);
    assert.equal((await db.query("select * from public.reports")).rows.length, 0);
    assert.equal((await db.query("select * from storage.objects")).rows.length, 0);
    await assert.rejects(db.exec(`insert into storage.objects(bucket_id,name) values ('dar-exports','${owner}/${reopened}/report.docx')`));
    await assert.rejects(call("reopen", reopened, next.updated_at));
    await db.exec("reset role; set role anon;"); await assert.rejects(call("save"));
  } finally { await db.close(); }
});

test("all-reports listing orders by date then version, pages, and stays owner-scoped", async () => {
  const db = new PGlite();
  const owner = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,public to authenticated; grant execute on function auth.uid() to authenticated;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(bucket_id text,name text,owner_id text, primary key(bucket_id,name));
      alter table storage.objects enable row level security; grant usage on schema storage to authenticated;
      grant select,insert,update,delete on storage.objects to authenticated;
      insert into auth.users values ('${owner}'),('${other}');`);
    for (const name of ["202609180001_foundation.sql", "202609180002_attendance_workflow.sql", "202609180003_reports.sql", "202609210004_absences.sql", "202609210005_report_submit_owner_id.sql", "202609210006_optional_report_exports.sql"]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));
    }
    await db.exec(`insert into public.allowed_users(user_id) values ('${owner}'),('${other}');
      insert into public.reports(user_id,report_date,revision,status) values
        ('${owner}','2020-09-16',1,'submitted'),('${owner}','2020-09-17',1,'submitted'),('${owner}','2020-09-17',2,'draft'),
        ('${owner}','2020-09-18',1,'ready'),('${other}','2020-09-14',1,'draft');
      set role authenticated; set request.jwt.claim.sub='${owner}';`);
    // Same query shape as listAllReports in src/models/reports.ts.
    const page = async (n: number, size = 2) => (await db.query<{ report_date: string; revision: number }>(
      "select to_char(report_date,'YYYY-MM-DD') as report_date, revision from public.reports where user_id=$1 order by report_date desc, revision desc offset $2 limit $3", [owner, (n - 1) * size, size])).rows;
    const all = [...await page(1), ...await page(2), ...await page(3)].map(r => `${r.report_date}#${r.revision}`);
    assert.deepEqual(all, ["2020-09-18#1", "2020-09-17#2", "2020-09-17#1", "2020-09-16#1"]);
    assert.equal((await page(4)).length, 0);
    // Same predicates as the from/to/status filters in listAllReports.
    const filtered = (await db.query<{ revision: number }>("select revision from public.reports where user_id=$1 and report_date >= $2 and report_date <= $3 and status = $4 order by report_date desc, revision desc", [owner, "2020-09-17", "2020-09-18", "submitted"])).rows;
    assert.deepEqual(filtered.map(r => r.revision), [1]);
    await db.exec(`set request.jwt.claim.sub='${other}';`);
    assert.equal((await db.query("select * from public.reports")).rows.length, 1);
  } finally { await db.close(); }
});

test("parsePage clamps untrusted page values", () => {
  assert.equal(parsePage(undefined), 1); assert.equal(parsePage("abc"), 1); assert.equal(parsePage("-5"), 1);
  assert.equal(parsePage("3"), 3); assert.equal(parsePage("99999999"), 10000);
});
