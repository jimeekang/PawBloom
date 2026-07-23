-- Profile email is an identity attribute used by privileged caregiver invites.
-- Keep it synchronized from auth.users and remove direct client writes so an
-- authenticated user cannot claim another person's email before an invite.

drop policy if exists "profiles own insert" on public.profiles;
drop policy if exists "profiles own update" on public.profiles;

revoke insert, update on public.profiles from authenticated;
grant select on public.profiles to authenticated;

update public.profiles profile
set email = null,
    updated_at = now()
from auth.users auth_user
where profile.id = auth_user.id
  and profile.email is distinct from auth_user.email;

insert into public.profiles (id, email)
select auth_user.id, auth_user.email
from auth.users auth_user
on conflict (id) do update
set email = excluded.email,
    updated_at = now();

-- Build the case-insensitive lookup guard only after replacing every
-- client-writable profile email with the canonical auth.users value. Creating
-- it in the preceding migration can fail on legacy duplicate or spoofed data
-- before this repair has a chance to run.
create unique index if not exists profiles_email_lower_unique_idx
on public.profiles (lower(email))
where email is not null;

insert into public.subscription_entitlements (user_id, plan, source)
select auth_user.id, 'free'::public.subscription_plan, 'identity-backfill'
from auth.users auth_user
on conflict (user_id) do nothing;

create or replace function app_private.sync_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  insert into public.subscription_entitlements (user_id, plan, source)
  values (new.id, 'free'::public.subscription_plan, 'signup')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_profile_changed on auth.users;
create trigger on_auth_user_profile_changed
after insert or update of email on auth.users
for each row
execute function app_private.sync_auth_user_profile();

drop function if exists app_private.handle_new_user();
