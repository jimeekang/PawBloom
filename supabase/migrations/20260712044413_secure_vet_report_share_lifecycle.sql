alter table public.report_share_tokens
  add column if not exists revoked_at timestamptz;

-- Raw tokens issued by older draft-generation code cannot be recovered safely.
-- Revoke them once, then issue a fresh bearer token only after owner confirmation.
update public.report_share_tokens
set revoked_at = coalesce(revoked_at, now())
where revoked_at is null;

create unique index if not exists report_share_tokens_one_active_per_report
  on public.report_share_tokens (report_id)
  where revoked_at is null;

create or replace function public.issue_vet_report_share_v1(
  p_report_id uuid,
  p_pet_id uuid,
  p_actor_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  report_status public.report_status;
  report_confirmed boolean;
begin
  if not app_private.has_pet_role(
    p_pet_id,
    p_actor_id,
    array['owner']::public.pet_member_role[]
  ) then
    raise exception 'Only the pet owner can issue a report link.' using errcode = '42501';
  end if;
  if p_token_hash is null
    or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_expires_at is null
    or p_expires_at <= now()
    or p_expires_at > now() + interval '8 days' then
    raise exception 'Invalid report share token.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('vet-report-share:' || p_report_id::text, 0));

  select report.status, report.confirmed_by_owner
    into report_status, report_confirmed
  from public.vet_reports as report
  where report.id = p_report_id and report.pet_id = p_pet_id
  for update;
  if not found then
    raise exception 'Report not found.' using errcode = 'P0002';
  end if;
  if not report_confirmed or report_status not in ('confirmed', 'shared') then
    raise exception 'Owner confirmation is required before issuing a report link.' using errcode = '42501';
  end if;

  update public.report_share_tokens as token
  set revoked_at = now()
  where token.report_id = p_report_id and token.revoked_at is null;

  insert into public.report_share_tokens (
    report_id, token_hash, expires_at, created_by, revoked_at
  ) values (
    p_report_id, p_token_hash, p_expires_at, p_actor_id, null
  );

  update public.vet_reports as report
  set status = 'shared', updated_at = now()
  where report.id = p_report_id;

  return jsonb_build_object(
    'reportId', p_report_id,
    'status', 'shared',
    'confirmedByOwner', true,
    'expiresAt', p_expires_at
  );
end;
$$;

create or replace function public.revoke_vet_report_share_v1(
  p_report_id uuid,
  p_pet_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  report_confirmed boolean;
begin
  if not app_private.has_pet_role(
    p_pet_id,
    p_actor_id,
    array['owner']::public.pet_member_role[]
  ) then
    raise exception 'Only the pet owner can revoke a report link.' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('vet-report-share:' || p_report_id::text, 0));

  select report.confirmed_by_owner
    into report_confirmed
  from public.vet_reports as report
  where report.id = p_report_id and report.pet_id = p_pet_id
  for update;
  if not found then
    raise exception 'Report not found.' using errcode = 'P0002';
  end if;
  if not report_confirmed then
    raise exception 'Only a confirmed report can have a share link.' using errcode = '42501';
  end if;

  update public.report_share_tokens as token
  set revoked_at = now()
  where token.report_id = p_report_id and token.revoked_at is null;

  update public.vet_reports as report
  set status = 'confirmed', updated_at = now()
  where report.id = p_report_id;

  return jsonb_build_object(
    'reportId', p_report_id,
    'status', 'confirmed',
    'confirmedByOwner', true
  );
end;
$$;

drop function if exists public.mark_vet_report_shared(uuid, uuid);
drop function if exists app_private.mark_vet_report_shared(uuid, uuid);

drop policy if exists "report_share_tokens report member select" on public.report_share_tokens;
revoke select, insert, update, delete on table public.report_share_tokens from authenticated;

drop policy if exists "vet_reports member select" on public.vet_reports;
create policy "vet_reports owner select" on public.vet_reports for select to authenticated
using (app_private.has_pet_role(pet_id, (select auth.uid()), array['owner']::public.pet_member_role[]));

revoke execute on function public.issue_vet_report_share_v1(uuid, uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.issue_vet_report_share_v1(uuid, uuid, uuid, text, timestamptz)
  to service_role;

revoke execute on function public.revoke_vet_report_share_v1(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.revoke_vet_report_share_v1(uuid, uuid, uuid)
  to service_role;
