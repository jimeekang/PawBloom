-- Serialize account deletion and worker rollback across independent requests.
-- Earlier Storage/copy/cron setup is retained exactly as previously deployed.
create table app_private.account_deletion_leases (
  user_id uuid primary key,
  operation_id uuid not null,
  expires_at timestamptz not null
);
revoke all on table app_private.account_deletion_leases from public, anon, authenticated;
grant select, insert, update, delete on table app_private.account_deletion_leases to service_role;

-- Ten minutes exceeds the hosted Edge Function's maximum worker lifetime (400s).
create or replace function public.claim_account_deletion_operation_v1(
  p_user_id uuid, p_operation_id uuid
)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  insert into app_private.account_deletion_leases (user_id, operation_id, expires_at)
  values (p_user_id, p_operation_id, now() + interval '10 minutes')
  on conflict (user_id) do update
    set operation_id = excluded.operation_id, expires_at = excluded.expires_at
    where account_deletion_leases.expires_at < now();
  return found;
end;
$$;

create or replace function public.release_account_deletion_operation_v1(
  p_user_id uuid, p_operation_id uuid
)
returns void language sql security definer set search_path = ''
as $$
  delete from app_private.account_deletion_leases
  where user_id = p_user_id and operation_id = p_operation_id;
$$;

create or replace function public.rollback_account_deletion_rehome_v1(
  p_user_id uuid, p_media_asset_id uuid
)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  rehome app_private.account_deletion_media_rehomes%rowtype;
begin
  if not exists (
    select 1 from app_private.account_deletion_jobs
    where user_id = p_user_id and status = 'preparing'
  ) or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Only an active account can roll back preparation.' using errcode = '55000';
  end if;
  select * into rehome from app_private.account_deletion_media_rehomes
  where user_id = p_user_id and media_asset_id = p_media_asset_id for update;
  if not found then return null; end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'pet-media' and name = rehome.source_path
  ) then
    raise exception 'Original media is unavailable for rollback.' using errcode = '55000';
  end if;
  perform set_config('pawbloom.account_deletion_rehome', 'on', true);
  update public.media_assets
  set storage_path = rehome.source_path
  where id = rehome.media_asset_id and storage_path = rehome.destination_path;
  if exists (
    select 1 from public.media_assets where storage_path = rehome.destination_path
  ) then
    raise exception 'The staged copy is still referenced.' using errcode = '55000';
  end if;
  delete from app_private.account_deletion_media_rehomes
  where user_id = p_user_id and media_asset_id = p_media_asset_id;
  return rehome.destination_path;
end;
$$;

create or replace function public.cancel_account_deletion_v1(p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from auth.users where id = p_user_id)
    or exists (select 1 from app_private.account_deletion_jobs
      where user_id = p_user_id and status <> 'preparing')
    or exists (select 1 from app_private.account_deletion_media_rehomes where user_id = p_user_id)
    or exists (select 1 from public.list_account_deletion_temporary_objects_v1(p_user_id)) then
    raise exception 'Account deletion rollback is incomplete.' using errcode = '55000';
  end if;
  delete from app_private.account_deletion_jobs where user_id = p_user_id and status = 'preparing';
end;
$$;

create or replace function public.list_pending_account_deletion_jobs_v1(p_limit integer default 25)
returns table (user_id uuid, job_id uuid, status text, owned_pet_ids uuid[], updated_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select job.user_id, job.job_id, job.status, job.owned_pet_ids, job.updated_at
  from app_private.account_deletion_jobs as job
  where not exists (
    select 1 from app_private.account_deletion_leases as lease
    where lease.user_id = job.user_id and lease.expires_at > now()
  )
  order by job.updated_at, job.user_id
  limit greatest(1, least(coalesce(p_limit, 25), 100));
$$;

create or replace function app_private.request_account_deletion_cleanup_v1()
returns void language plpgsql security definer set search_path = ''
as $$
declare
  functions_url text;
  worker_secret text;
begin
  delete from app_private.account_deletion_leases where expires_at < now();
  select decrypted_secret into functions_url from vault.decrypted_secrets
  where name = 'pawbloom_functions_url';
  select decrypted_secret into worker_secret from vault.decrypted_secrets
  where name = 'pawbloom_account_deletion_worker_secret';
  if functions_url is null or worker_secret is null then return; end if;
  perform net.http_post(
    url := rtrim(functions_url, '/') || '/functions/v1/delete-account',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-pawbloom-account-deletion-worker', worker_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
end;
$$;

revoke execute on function public.claim_account_deletion_operation_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_account_deletion_operation_v1(uuid, uuid) to service_role;
revoke execute on function public.release_account_deletion_operation_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.release_account_deletion_operation_v1(uuid, uuid) to service_role;
