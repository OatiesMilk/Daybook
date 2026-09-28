begin;

-- New students must choose their own requirement during profile setup. Existing
-- configured values are retained; only newly provisioned profiles start unset.
alter table public.profiles alter column target_hours drop default;
alter table public.profiles alter column target_hours drop not null;

-- Auth owns auth.users. This small, security-definer trigger is the supported
-- Supabase pattern for creating corresponding application rows. Conflict-safe
-- inserts preserve existing profiles and administrator suspensions.
create function public.daybook_handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.allowed_users (user_id, active)
  values (new.id, true)
  on conflict (user_id) do nothing;

  insert into public.profiles (user_id, target_hours)
  values (new.id, null)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.daybook_handle_new_user() from public, anon, authenticated;

create trigger daybook_provision_new_user
  after insert on auth.users
  for each row execute function public.daybook_handle_new_user();

-- Bring Auth users created before this migration into the open product without
-- overwriting an existing allowlist row or profile.
insert into public.allowed_users (user_id, active)
select id, true from auth.users
on conflict (user_id) do nothing;

insert into public.profiles (user_id, target_hours)
select id, null from auth.users
on conflict (user_id) do nothing;

commit;
