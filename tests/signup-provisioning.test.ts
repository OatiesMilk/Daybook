import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const existing = "11111111-1111-4111-8111-111111111111";
const newUser = "22222222-2222-4222-8222-222222222222";

test("open signup provisions isolated profiles and preserves suspension", async () => {
  const db = new PGlite();
  try {
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
      insert into auth.users values ('${existing}');
    `);
    await db.exec(await readFile(new URL("../supabase/migrations/202609180001_foundation.sql", import.meta.url), "utf8"));
    await db.exec(`insert into public.allowed_users(user_id,active) values ('${existing}',false);
      insert into public.profiles(user_id,full_name) values ('${existing}','Existing Student');`);
    await db.exec(await readFile(new URL("../supabase/migrations/202609210008_profile_target_hours.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/202609280009_open_signup_provisioning.sql", import.meta.url), "utf8"));

    const retained = (await db.query<{ active: boolean; target_hours: number | null }>(`
      select a.active,p.target_hours from public.allowed_users a join public.profiles p using(user_id)
      where a.user_id=$1`, [existing])).rows[0];
    assert.deepEqual(retained, { active: false, target_hours: 486 });

    await db.exec(`insert into auth.users values ('${newUser}')`);
    const provisioned = (await db.query<{ active: boolean; target_hours: number | null; full_name: string }>(`
      select a.active,p.target_hours,p.full_name from public.allowed_users a join public.profiles p using(user_id)
      where a.user_id=$1`, [newUser])).rows[0];
    assert.deepEqual(provisioned, { active: true, target_hours: null, full_name: "" });

    await db.exec(`set role authenticated; set request.jwt.claim.sub='${newUser}';
      update public.profiles set full_name='New Student',target_hours=600 where user_id='${newUser}';`);
    assert.equal((await db.query("select * from public.profiles")).rows.length, 1);
    await assert.rejects(db.exec(`update public.allowed_users set active=false where user_id='${newUser}'`));

    await db.exec(`reset role; update public.allowed_users set active=false where user_id='${newUser}';
      set role authenticated; set request.jwt.claim.sub='${newUser}';`);
    assert.equal((await db.query("select * from public.profiles")).rows.length, 0);
    assert.equal((await db.query(`update public.profiles set full_name='Bypass' where user_id='${newUser}' returning *`)).rows.length, 0);
    await db.exec("reset role");
    assert.deepEqual((await db.query<{ active: boolean; full_name: string }>(`
      select a.active,p.full_name from public.allowed_users a join public.profiles p using(user_id)
      where a.user_id=$1`, [newUser])).rows[0], { active: false, full_name: "New Student" });
  } finally { await db.close(); }
});
