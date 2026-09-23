-- Personal access is provisioned by the project owner in the SQL editor.
-- There is intentionally no client-side registration or allowlist management.
create table public.allowed_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.allowed_users enable row level security;
revoke all on public.allowed_users from anon, authenticated;
grant select on public.allowed_users to authenticated;
create policy "Read own access" on public.allowed_users for select to authenticated
  using (user_id = (select auth.uid()));

create table public.profiles (
  user_id uuid primary key references public.allowed_users(user_id) on delete cascade,
  full_name text not null default '' check (length(full_name) <= 200),
  school text not null default '' check (length(school) <= 200),
  department text not null default '' check (length(department) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.regular_minutes(start_time time, end_time time)
returns integer language sql immutable strict set search_path = '' as $$
  select (
    greatest(0, extract(epoch from (least(end_time, time '12:00') - greatest(start_time, time '08:30'))) / 60)
    + greatest(0, extract(epoch from (least(end_time, time '18:30') - greatest(start_time, time '13:00'))) / 60)
  )::integer
$$;

create function public.overtime_minutes(start_time time, end_time time, enabled boolean)
returns integer language sql immutable strict set search_path = '' as $$
  select case when enabled then
    (greatest(0, extract(epoch from (end_time - greatest(start_time, time '18:30'))) / 60))::integer
  else 0 end
$$;

create table public.attendance (
  user_id uuid not null references public.allowed_users(user_id) on delete cascade,
  work_date date not null check (extract(isodow from work_date) between 1 and 5),
  time_in time not null,
  time_out time not null,
  work_location text not null default 'office' check (work_location in ('office', 'home')),
  overtime_enabled boolean not null default false,
  regular_minutes integer generated always as (public.regular_minutes(time_in, time_out)) stored,
  overtime_minutes integer generated always as (public.overtime_minutes(time_in, time_out, overtime_enabled)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, work_date),
  check (time_out > time_in),
  check (time_out < time '24:00'),
  check (extract(second from time_in) = 0 and extract(second from time_out) = 0)
);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger attendance_updated_at before update on public.attendance
  for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.attendance enable row level security;
revoke all on public.profiles, public.attendance from anon, authenticated;
grant select, insert, update, delete on public.profiles, public.attendance to authenticated;

create policy "Owner profile access" on public.profiles for all to authenticated
using (
  user_id = (select auth.uid()) and exists (
    select 1 from public.allowed_users a where a.user_id = (select auth.uid()) and a.active
  )
)
with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.allowed_users a where a.user_id = (select auth.uid()) and a.active
  )
);

create policy "Owner attendance access" on public.attendance for all to authenticated
using (
  user_id = (select auth.uid()) and exists (
    select 1 from public.allowed_users a where a.user_id = (select auth.uid()) and a.active
  )
)
with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.allowed_users a where a.user_id = (select auth.uid()) and a.active
  )
);

-- Numeric minute totals are derived by PostgreSQL, never accepted from the client.
-- The composite primary key also indexes owner/date history lookups.

create function public.attendance_summary(through_date date)
returns table (total_minutes bigint, recorded_days bigint)
language sql stable security invoker set search_path = '' as $$
  select coalesce(sum(regular_minutes + overtime_minutes), 0)::bigint, count(*)
  from public.attendance
  where user_id = (select auth.uid()) and work_date <= through_date
$$;
revoke all on function public.attendance_summary(date) from public, anon;
grant execute on function public.attendance_summary(date) to authenticated;
