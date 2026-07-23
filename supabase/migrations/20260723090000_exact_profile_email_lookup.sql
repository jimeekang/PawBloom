-- Caregiver invitations must resolve one exact canonical identity. PostgREST
-- `ilike` filters treat `%` and `_` inside a valid email address as wildcards,
-- so keep the case-insensitive comparison behind a service-role-only RPC.

create or replace function public.lookup_profile_id_by_email(target_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select profile.id
  from public.profiles profile
  where lower(profile.email) = lower(pg_catalog.btrim(target_email))
  limit 1;
$$;

revoke all on function public.lookup_profile_id_by_email(text) from public, anon, authenticated;
grant execute on function public.lookup_profile_id_by_email(text) to service_role;
