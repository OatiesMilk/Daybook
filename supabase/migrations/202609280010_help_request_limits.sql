begin;

-- One bounded row per account, no messages or private product data. Shared
-- counters and expiring permits work across serverless instances, not just one
-- Node process. Only these auth-bound commands may touch the table.
create table public.help_request_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  minute_start timestamptz not null,
  minute_count integer not null check (minute_count between 0 and 20),
  day_start date not null,
  day_count integer not null check (day_count between 0 and 200),
  lease uuid,
  leased_until timestamptz
);
alter table public.help_request_limits enable row level security;
revoke all on public.help_request_limits from public, anon, authenticated;

create function public.acquire_help_request()
returns text language plpgsql security definer set search_path = ''
set statement_timeout = '2s' set lock_timeout = '1s' as $$
declare
  owner_id uuid := auth.uid();
  instant timestamptz := clock_timestamp();
  minute_bucket timestamptz := date_trunc('minute', instant);
  day_bucket date := (instant at time zone 'UTC')::date;
  counter public.help_request_limits%rowtype;
  permit uuid := gen_random_uuid();
begin
  if owner_id is null or not exists (
    select 1 from public.allowed_users where user_id = owner_id and active
  ) then raise exception 'Not authorized' using errcode = '42501'; end if;
  insert into public.help_request_limits values (owner_id, minute_bucket, 0, day_bucket, 0, null, null)
    on conflict (user_id) do nothing;
  select * into counter from public.help_request_limits where user_id = owner_id for update;
  if counter.minute_start <> minute_bucket then counter.minute_count := 0; end if;
  if counter.day_start <> day_bucket then counter.day_count := 0; end if;
  if counter.minute_count >= 20 or counter.day_count >= 200 then return 'limited'; end if;
  if counter.leased_until > instant then return 'busy'; end if;
  update public.help_request_limits set
    minute_start = minute_bucket, minute_count = counter.minute_count + 1,
    day_start = day_bucket, day_count = counter.day_count + 1,
    lease = permit, leased_until = instant + interval '10 seconds'
    where user_id = owner_id;
  return permit::text;
end;
$$;

create function public.release_help_request(permit uuid)
returns void language sql security definer set search_path = ''
set statement_timeout = '2s' set lock_timeout = '1s' as $$
  update public.help_request_limits set lease = null, leased_until = null
    where user_id = auth.uid() and lease = permit;
$$;
revoke all on function public.acquire_help_request() from public, anon;
revoke all on function public.release_help_request(uuid) from public, anon;
grant execute on function public.acquire_help_request(), public.release_help_request(uuid) to authenticated;

commit;
