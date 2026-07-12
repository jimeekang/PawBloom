-- Report artifacts are produced by the service-backed edge function. Mobile clients
-- may read/delete their authorized rows, but cannot author or mutate report content.
revoke insert, update on table public.vet_reports from authenticated;
revoke insert, update on table public.report_share_tokens from authenticated;

drop policy if exists "vet_reports owner caregiver insert" on public.vet_reports;
drop policy if exists "vet_reports owner caregiver update" on public.vet_reports;
drop policy if exists "report_share_tokens owner caregiver insert" on public.report_share_tokens;

create or replace function app_private.confirm_vet_report(
  target_report_id uuid,
  target_pet_id uuid
)
returns table (
  id uuid,
  status public.report_status,
  confirmed_by_owner boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  report_status public.report_status;
  report_confirmed boolean;
begin
  if actor_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if not app_private.has_pet_role(
    target_pet_id,
    actor_user_id,
    array['owner']::public.pet_member_role[]
  ) then
    raise exception 'Only the pet owner can confirm a report.' using errcode = '42501';
  end if;

  select vr.status, vr.confirmed_by_owner
    into report_status, report_confirmed
  from public.vet_reports as vr
  where vr.id = target_report_id
    and vr.pet_id = target_pet_id
  for update;

  if not found then
    raise exception 'Report not found.' using errcode = 'P0002';
  end if;

  if report_status = 'draft' and not report_confirmed then
    update public.vet_reports as vr
    set status = 'confirmed',
        confirmed_by_owner = true,
        updated_at = now()
    where vr.id = target_report_id;
  elsif report_status <> 'confirmed' or not report_confirmed then
    raise exception 'Report cannot be confirmed from its current state.' using errcode = '22023';
  end if;

  return query
  select vr.id, vr.status, vr.confirmed_by_owner
  from public.vet_reports as vr
  where vr.id = target_report_id;
end;
$$;

create or replace function app_private.mark_vet_report_shared(
  target_report_id uuid,
  target_pet_id uuid
)
returns table (
  id uuid,
  status public.report_status,
  confirmed_by_owner boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  report_status public.report_status;
  report_confirmed boolean;
begin
  if actor_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if not app_private.has_pet_role(
    target_pet_id,
    actor_user_id,
    array['owner','caregiver']::public.pet_member_role[]
  ) then
    raise exception 'Only the pet care team can share a confirmed report.' using errcode = '42501';
  end if;

  select vr.status, vr.confirmed_by_owner
    into report_status, report_confirmed
  from public.vet_reports as vr
  where vr.id = target_report_id
    and vr.pet_id = target_pet_id
  for update;

  if not found then
    raise exception 'Report not found.' using errcode = 'P0002';
  end if;

  if not report_confirmed or report_status not in ('confirmed', 'shared') then
    raise exception 'Owner confirmation is required before sharing.' using errcode = '42501';
  end if;

  if report_status = 'confirmed' then
    update public.vet_reports as vr
    set status = 'shared',
        updated_at = now()
    where vr.id = target_report_id;
  end if;

  return query
  select vr.id, vr.status, vr.confirmed_by_owner
  from public.vet_reports as vr
  where vr.id = target_report_id;
end;
$$;

create or replace function public.confirm_vet_report(
  target_report_id uuid,
  target_pet_id uuid
)
returns table (
  id uuid,
  status public.report_status,
  confirmed_by_owner boolean
)
language sql
security invoker
set search_path = ''
as $$
  select *
  from app_private.confirm_vet_report(target_report_id, target_pet_id);
$$;

create or replace function public.mark_vet_report_shared(
  target_report_id uuid,
  target_pet_id uuid
)
returns table (
  id uuid,
  status public.report_status,
  confirmed_by_owner boolean
)
language sql
security invoker
set search_path = ''
as $$
  select *
  from app_private.mark_vet_report_shared(target_report_id, target_pet_id);
$$;

revoke execute on function app_private.confirm_vet_report(uuid, uuid) from public, anon;
revoke execute on function app_private.mark_vet_report_shared(uuid, uuid) from public, anon;
grant usage on schema app_private to authenticated;
grant execute on function app_private.confirm_vet_report(uuid, uuid) to authenticated;
grant execute on function app_private.mark_vet_report_shared(uuid, uuid) to authenticated;

revoke execute on function public.confirm_vet_report(uuid, uuid) from public, anon;
revoke execute on function public.mark_vet_report_shared(uuid, uuid) from public, anon;
grant execute on function public.confirm_vet_report(uuid, uuid) to authenticated;
grant execute on function public.mark_vet_report_shared(uuid, uuid) to authenticated;
