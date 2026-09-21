begin;

-- A recorded absence has no clock times and earns no minutes. Existing
-- attendance remains present by default, including unfinished entries.
alter table public.attendance add column absent boolean not null default false;
alter table public.attendance alter column time_in drop not null;
alter table public.attendance add constraint attendance_absence_times_check check (
  (absent and time_in is null and time_out is null and not overtime_enabled)
  or (not absent and time_in is not null)
);

-- Completed days represent worked days, not recorded absences.
create or replace function public.attendance_summary(through_date date)
returns table (total_minutes bigint, recorded_days bigint)
language sql stable security invoker set search_path = '' as $$
  select coalesce(sum(regular_minutes + overtime_minutes), 0)::bigint, count(*)
  from public.attendance
  where user_id = (select auth.uid()) and work_date <= through_date
    and not absent and time_out is not null
$$;

commit;
