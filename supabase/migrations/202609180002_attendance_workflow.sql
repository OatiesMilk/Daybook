begin;

-- Open attendance has no credit until a time out is recorded. The existing
-- STRICT generated-column functions return NULL for an unfinished interval.
alter table public.attendance alter column time_out drop not null;

create function public.validate_attendance_date() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.work_date > (now() at time zone 'Asia/Manila')::date then
    raise exception 'Attendance cannot be in the future' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger attendance_date_validation before insert or update on public.attendance
  for each row execute function public.validate_attendance_date();

create or replace function public.attendance_summary(through_date date)
returns table (total_minutes bigint, recorded_days bigint)
language sql stable security invoker set search_path = '' as $$
  select coalesce(sum(regular_minutes + overtime_minutes), 0)::bigint, count(*)
  from public.attendance
  where user_id = (select auth.uid()) and work_date <= through_date and time_out is not null
$$;

commit;
