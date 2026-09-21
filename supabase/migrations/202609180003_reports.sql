begin;
alter table public.profiles add column last_name text not null default '' check (length(last_name) <= 100);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.allowed_users(user_id) on delete cascade,
  report_date date not null check (extract(isodow from report_date) between 1 and 5),
  revision integer not null default 1 check (revision > 0),
  status text not null default 'draft' check (status in ('draft','ready','submitted')),
  rows jsonb not null default '[]'::jsonb check (jsonb_typeof(rows) = 'array' and jsonb_array_length(rows) <= 100),
  snapshot jsonb,
  needs_review boolean not null default false,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, report_date, revision)
);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;
create policy "Read own reports" on public.reports for select to authenticated using (
  user_id = (select auth.uid()) and exists(select 1 from public.allowed_users where user_id = (select auth.uid()) and active)
);

-- Serialize attendance/profile changes and snapshots for each owner. Trigger
-- functions are not callable through the Data API as ordinary RPCs.
create function public.lock_owner_record() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.allowed_users where user_id = coalesce(new.user_id, old.user_id) for update;
  return coalesce(new, old);
end; $$;
create trigger attendance_owner_lock before insert or update or delete on public.attendance for each row execute function public.lock_owner_record();
create trigger profile_owner_lock before insert or update or delete on public.profiles for each row execute function public.lock_owner_record();

create function public.flag_report_changes() returns trigger language plpgsql security definer set search_path = '' as $$
declare affected date;
begin
  affected := case when tg_op = 'INSERT' then new.work_date when tg_op = 'DELETE' then old.work_date else least(new.work_date, old.work_date) end;
  update public.reports set needs_review = true, updated_at = clock_timestamp()
    where user_id = coalesce(new.user_id, old.user_id) and report_date >= affected and status <> 'draft';
  return coalesce(new, old);
end; $$;
create trigger attendance_report_review after insert or update or delete on public.attendance for each row execute function public.flag_report_changes();

create function public.report_command(command text, work_day date, report_id uuid default null,
  expected_version timestamptz default null, activity_rows jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid(); item public.reports; latest public.reports; profile public.profiles;
  entry jsonb; credit bigint; result_id uuid;
begin
  perform 1 from public.allowed_users where user_id = owner_id and active for update;
  if not found then raise exception 'Account has no access' using errcode = '42501'; end if;
  if work_day is null or work_day > (now() at time zone 'Asia/Manila')::date or extract(isodow from work_day) not between 1 and 5 then
    raise exception 'Choose today or an earlier weekday';
  end if;
  select * into latest from public.reports where user_id = owner_id and report_date = work_day order by revision desc limit 1;
  if report_id is not null then
    select * into item from public.reports where id = report_id and user_id = owner_id for update;
    if not found or item.report_date <> work_day or item.id <> latest.id or item.updated_at is distinct from expected_version then
      raise exception 'Report changed or is not the latest revision. Reload before continuing.';
    end if;
  elsif latest.id is not null then raise exception 'A report already exists for this day. Open its latest revision.';
  end if;

  if command = 'save' then
    if report_id is not null and item.status <> 'draft' then raise exception 'Reopen the report before editing'; end if;
    if activity_rows is null or jsonb_typeof(activity_rows) <> 'array' then raise exception 'Activities must be a list'; end if;
    if jsonb_array_length(activity_rows) > 100 then raise exception 'Use at most 100 activity rows'; end if;
    for entry in select * from jsonb_array_elements(activity_rows) loop
      if jsonb_typeof(entry) <> 'object'
        or jsonb_typeof(entry->'project') is distinct from 'string'
        or jsonb_typeof(entry->'task') is distinct from 'string'
        or jsonb_typeof(entry->'remarks') is distinct from 'string'
        or (entry->>'status') is null or (entry->>'status') not in ('Completed','Ongoing')
        or length(entry->>'project') > 200 or length(entry->>'task') > 4000 or length(entry->>'remarks') > 4000 then
        raise exception 'Invalid activity row';
      end if;
    end loop;
    if report_id is null then
      insert into public.reports(user_id,report_date,rows) values(owner_id,work_day,activity_rows) returning id into result_id;
    else
      update public.reports set rows=activity_rows, updated_at=clock_timestamp() where id=report_id returning id into result_id;
    end if;
  elsif command = 'ready' and report_id is not null then
    if item.status <> 'draft' then raise exception 'Only a draft can become Ready'; end if;
    if not exists(select 1 from public.attendance where user_id=owner_id and work_date=work_day and time_out is not null) then
      raise exception 'Complete attendance for this date before marking Ready'; end if;
    if jsonb_array_length(item.rows)=0 then raise exception 'Add at least one activity'; end if;
    for entry in select * from jsonb_array_elements(item.rows) loop
      if length(trim(entry->>'task'))=0 or length(trim(entry->>'project'))=0 then raise exception 'Each activity needs a project and task description'; end if;
    end loop;
    select * into profile from public.profiles where user_id=owner_id;
    if not found or trim(profile.full_name)='' or trim(profile.last_name)='' or trim(profile.school)='' or trim(profile.department)='' then
      raise exception 'Complete your profile before marking Ready'; end if;
    select coalesce(sum(regular_minutes+overtime_minutes),0) into credit from public.attendance
      where user_id=owner_id and work_date<=work_day and time_out is not null;
    update public.reports set status='ready', needs_review=false, updated_at=clock_timestamp(),
      snapshot=jsonb_build_object('profile',to_jsonb(profile),'date',work_day,'totalMinutes',credit,'rows',item.rows)
      where id=report_id returning id into result_id;
  elsif command = 'submit' and report_id is not null then
    if item.status <> 'ready' or item.needs_review then raise exception 'Only a current Ready report can be submitted. Reopen and review changed attendance.'; end if;
    if not exists(select 1 from storage.objects where bucket_id='dar-exports' and name=owner_id::text||'/'||report_id::text||'/report.docx')
      or not exists(select 1 from storage.objects where bucket_id='dar-exports' and name=owner_id::text||'/'||report_id::text||'/report.pdf') then
      raise exception 'Export both DOCX and PDF before marking Submitted'; end if;
    update public.reports set status='submitted',submitted_at=now(),updated_at=clock_timestamp() where id=report_id returning id into result_id;
  elsif command = 'reopen' and report_id is not null then
    if item.status='draft' then raise exception 'This report is already a draft'; end if;
    insert into public.reports(user_id,report_date,revision,rows)
      values(owner_id,work_day,item.revision+1,item.rows) returning id into result_id;
  else raise exception 'Invalid report action';
  end if;
  return result_id;
end; $$;
revoke all on function public.report_command(text,date,uuid,timestamptz,jsonb) from public, anon;
grant execute on function public.report_command(text,date,uuid,timestamptz,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('dar-exports','dar-exports',false,10485760,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
create policy "Owner reads report exports" on storage.objects for select to authenticated using (
  bucket_id='dar-exports' and exists(select 1 from public.reports r where name=r.user_id::text||'/'||r.id::text||'/report.docx'
    or name=r.user_id::text||'/'||r.id::text||'/report.pdf')
);
create policy "Owner creates immutable report exports" on storage.objects for insert to authenticated with check (
  bucket_id='dar-exports' and exists(select 1 from public.reports r where r.status='ready' and
    (name=r.user_id::text||'/'||r.id::text||'/report.docx' or name=r.user_id::text||'/'||r.id::text||'/report.pdf'))
);
-- No update/delete policy: old exports remain byte-for-byte unchanged.
commit;
