begin;

-- Students who started their internship before joining Daybook can carry over
-- the hours they already rendered as one self-reported starting balance. No
-- attendance rows are fabricated: the balance covers every date up to and
-- including prior_hours_as_of, and attendance is blocked for those dates so
-- the same hours can never be counted twice. Existing profiles start at zero.
alter table public.profiles
  add column prior_minutes integer not null default 0,
  add column prior_hours_as_of date,
  add column prior_hours_note text not null default '' check (length(prior_hours_note) <= 300),
  add constraint profiles_prior_minutes_range check (prior_minutes between 0 and 600000),
  add constraint profiles_prior_hours_date check ((prior_minutes = 0) = (prior_hours_as_of is null)),
  add constraint profiles_prior_within_target check (
    prior_minutes = 0 or (target_hours is not null and prior_minutes <= target_hours * 60)
  );

-- Custom SQLSTATEs let the app show specific messages; DETAIL carries the
-- covered-through date. These checks are SECURITY INVOKER on purpose: BEFORE
-- triggers run ahead of the RLS WITH CHECK, so a definer function would read
-- (and leak through DETAIL) another student's dates when someone writes a row
-- with a foreign user_id. Under RLS the caller sees only their own rows, and the
-- write is then rejected by the policy. Trigger names sort after the existing
-- *_owner_lock triggers, so each runs while the per-owner lock is held and
-- concurrent profile/attendance writes cannot slip past each other.
create function public.validate_attendance_prior_period() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare covered date;
begin
  select prior_hours_as_of into covered from public.profiles where user_id = new.user_id;
  if covered is not null and new.work_date <= covered then
    raise exception 'Attendance date is covered by carried-over hours'
      using errcode = 'DBC01', detail = covered::text;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_attendance_prior_period() from public, anon, authenticated;
create trigger attendance_prior_period_check before insert or update on public.attendance
  for each row execute function public.validate_attendance_prior_period();

create function public.validate_profile_prior_hours() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare overlap date;
begin
  if new.prior_hours_as_of is not null then
    if new.prior_hours_as_of > (now() at time zone 'Asia/Manila')::date then
      raise exception 'Carried-over hours cannot be counted up to a future date' using errcode = '23514';
    end if;
    select max(work_date) into overlap from public.attendance
      where user_id = new.user_id and work_date <= new.prior_hours_as_of;
    if overlap is not null then
      raise exception 'Attendance already exists inside the carried-over period'
        using errcode = 'DBC02', detail = overlap::text;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_profile_prior_hours() from public, anon, authenticated;
create trigger profile_prior_hours_check before insert or update of prior_minutes, prior_hours_as_of on public.profiles
  for each row execute function public.validate_profile_prior_hours();

-- Ready/Submitted snapshots freeze cumulative hours, so changing the balance
-- flags them for review exactly like an attendance correction does. Definer is
-- required (clients cannot update reports) and safe: it runs AFTER the update,
-- which RLS has already restricted to the caller's own profile.
create function public.flag_prior_hours_changes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.prior_minutes is distinct from old.prior_minutes or new.prior_hours_as_of is distinct from old.prior_hours_as_of then
    update public.reports set needs_review = true, updated_at = clock_timestamp()
      where user_id = new.user_id and status <> 'draft';
  end if;
  return new;
end;
$$;
revoke all on function public.flag_prior_hours_changes() from public, anon, authenticated;
create trigger profile_prior_hours_review after update on public.profiles
  for each row execute function public.flag_prior_hours_changes();

-- Totals now include the carried-over balance once its covered period has
-- started. recorded_days remains attendance-only: carried-over hours have no
-- per-day records and must not distort worked-day counts or pace.
create or replace function public.attendance_summary(through_date date)
returns table (total_minutes bigint, recorded_days bigint)
language sql stable security invoker set search_path = '' as $$
  select
    coalesce((select sum(a.regular_minutes + a.overtime_minutes) from public.attendance a
      where a.user_id = (select auth.uid()) and a.work_date <= through_date
        and not a.absent and a.time_out is not null), 0)::bigint
    + coalesce((select p.prior_minutes from public.profiles p
      where p.user_id = (select auth.uid()) and p.prior_hours_as_of <= through_date), 0)::bigint,
    (select count(*) from public.attendance a
      where a.user_id = (select auth.uid()) and a.work_date <= through_date
        and not a.absent and a.time_out is not null)
$$;

-- Same as migration 007, except Ready snapshots add the carried-over balance.
-- A Ready date always has attendance, which is only allowed after the covered
-- period, so the balance always applies to it.
create or replace function public.report_command(command text, work_day date, report_id uuid default null,
  expected_version timestamptz default null, activity_rows jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); item public.reports; latest public.reports; profile public.profiles;
  entry jsonb; credit bigint; result_id uuid;
begin
  perform 1 from public.allowed_users where user_id = v_user_id and active for update;
  if not found then raise exception 'Account has no access' using errcode = '42501'; end if;
  if work_day is null or work_day > (now() at time zone 'Asia/Manila')::date or extract(isodow from work_day) not between 1 and 5 then
    raise exception 'Choose today or an earlier weekday';
  end if;
  select * into latest from public.reports where user_id = v_user_id and report_date = work_day order by revision desc limit 1;
  if report_id is not null then
    select * into item from public.reports where id = report_id and user_id = v_user_id for update;
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
      insert into public.reports(user_id,report_date,rows) values(v_user_id,work_day,activity_rows) returning id into result_id;
    else
      update public.reports set rows=activity_rows, updated_at=clock_timestamp() where id=report_id returning id into result_id;
    end if;
  elsif command = 'delete' and report_id is not null then
    if item.status <> 'draft' then raise exception 'Only a draft can be deleted'; end if;
    delete from public.reports where id=report_id returning id into result_id;
  elsif command = 'ready' and report_id is not null then
    if item.status <> 'draft' then raise exception 'Only a draft can become Ready'; end if;
    if not exists(select 1 from public.attendance where user_id=v_user_id and work_date=work_day and time_out is not null) then
      raise exception 'Complete attendance for this date before marking Ready'; end if;
    if jsonb_array_length(item.rows)=0 then raise exception 'Add at least one activity'; end if;
    for entry in select * from jsonb_array_elements(item.rows) loop
      if length(trim(entry->>'task'))=0 or length(trim(entry->>'project'))=0 then raise exception 'Each activity needs a project and task description'; end if;
    end loop;
    select * into profile from public.profiles where user_id=v_user_id;
    if not found or trim(profile.full_name)='' or trim(profile.last_name)='' or trim(profile.school)='' or trim(profile.department)='' then
      raise exception 'Complete your profile before marking Ready'; end if;
    select coalesce(sum(regular_minutes+overtime_minutes),0) into credit from public.attendance
      where user_id=v_user_id and work_date<=work_day and time_out is not null;
    if profile.prior_hours_as_of is not null and profile.prior_hours_as_of <= work_day then
      credit := credit + profile.prior_minutes;
    end if;
    update public.reports set status='ready', needs_review=false, updated_at=clock_timestamp(),
      snapshot=jsonb_build_object('profile',to_jsonb(profile),'date',work_day,'totalMinutes',credit,'rows',item.rows)
      where id=report_id returning id into result_id;
  elsif command = 'submit' and report_id is not null then
    if item.status <> 'ready' or item.needs_review then raise exception 'Only a current Ready report can be submitted. Reopen and review changed attendance.'; end if;
    update public.reports set status='submitted',submitted_at=now(),updated_at=clock_timestamp() where id=report_id returning id into result_id;
  elsif command = 'reopen' and report_id is not null then
    if item.status='draft' then raise exception 'This report is already a draft'; end if;
    insert into public.reports(user_id,report_date,revision,rows)
      values(v_user_id,work_day,item.revision+1,item.rows) returning id into result_id;
  else raise exception 'Invalid report action';
  end if;
  return result_id;
end; $$;

revoke all on function public.report_command(text,date,uuid,timestamptz,jsonb) from public, anon;
grant execute on function public.report_command(text,date,uuid,timestamptz,jsonb) to authenticated;

commit;
