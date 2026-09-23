begin;

-- Exports are optional at submission time. Preserve the existing report
-- state machine while allowing immutable exports to be created afterward.
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

alter policy "Owner creates immutable report exports" on storage.objects with check (
  bucket_id='dar-exports' and exists(select 1 from public.reports r where r.status in ('ready','submitted') and
    (name=r.user_id::text||'/'||r.id::text||'/report.docx' or name=r.user_id::text||'/'||r.id::text||'/report.pdf'))
);

commit;
