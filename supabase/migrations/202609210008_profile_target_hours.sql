begin;

-- Each owner can configure the internship requirement used by dashboard
-- progress. Existing profiles retain the original 486-hour target.
alter table public.profiles
  add column target_hours integer not null default 486
  check (target_hours between 1 and 10000);

commit;
