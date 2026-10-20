-- Keep account deletion safe across Storage/Auth boundaries. Storage objects
-- are not foreign-keyed to auth.users, and hosted behavior can differ from the
-- documented hard-delete precondition, so the Edge Function first re-homes
-- registered media through the Storage API and proves no object still names
-- the deleting user. The durable job also blocks new media writes during the
-- operation and retains owned-pet prefixes if post-Auth cleanup must resume.
create extension if not exists pg_cron with schema pg_catalog;

create extension if not exists pg_net with schema extensions;

create table app_private.account_deletion_jobs (
  user_id uuid primary key,
  job_id uuid not null unique default gen_random_uuid(),
  owned_pet_ids uuid[] not null default array[]::uuid[],
  status text not null default 'preparing'
    check (status in ('preparing', 'auth_deleted')),
  cleanup_attempts integer not null default 0,
  last_error text,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app_private.account_deletion_media_rehomes (
  user_id uuid not null references app_private.account_deletion_jobs(user_id) on delete cascade,
  media_asset_id uuid not null,
  source_path text not null,
  destination_path text not null unique,
  created_at timestamptz not null default now(),
  primary key (user_id, media_asset_id)
);

revoke all on table app_private.account_deletion_jobs from public, anon, authenticated;

grant select, insert, update, delete on table app_private.account_deletion_jobs to service_role;

revoke all on table app_private.account_deletion_media_rehomes from public, anon, authenticated;

grant select, insert, update, delete on table app_private.account_deletion_media_rehomes to service_role;

create or replace function app_private.account_deletion_blocks_media(target_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_storage_path like '%/.account-deletion/%'
    or exists (
      select 1
      from app_private.account_deletion_jobs as job
      where job.user_id = (select auth.uid())
        or exists (
          select 1
          from unnest(job.owned_pet_ids) as captured(pet_id)
          where captured.pet_id::text = split_part(target_storage_path, '/', 1)
        )
        or exists (
          select 1
          from public.pets as pet
          where pet.owner_id = job.user_id
            and pet.id::text = split_part(target_storage_path, '/', 1)
        )
    );
$$;

revoke execute on function app_private.account_deletion_blocks_media(text)
  from public, anon;

grant execute on function app_private.account_deletion_blocks_media(text)
  to authenticated;

drop policy if exists "pet media account deletion insert guard" on storage.objects;

create policy "pet media account deletion insert guard"
on storage.objects as restrictive for insert to authenticated
with check (
  bucket_id <> 'pet-media'
  or not app_private.account_deletion_blocks_media(name)
);

drop policy if exists "pet media account deletion update guard" on storage.objects;

create policy "pet media account deletion update guard"
on storage.objects as restrictive for update to authenticated
using (
  bucket_id <> 'pet-media'
  or not app_private.account_deletion_blocks_media(name)
)
with check (
  bucket_id <> 'pet-media'
  or not app_private.account_deletion_blocks_media(name)
);

-- Extend the existing registration trigger so an upload that raced the job
-- cannot be registered after deletion started. The service-only re-home RPC
-- sets a transaction-local bypass solely around its verified metadata update.
create or replace function app_private.prevent_queued_media_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('media-cleanup:' || new.storage_path, 0)
  );
  if exists (
    select 1
    from app_private.media_cleanup_jobs as job
    where job.storage_path = new.storage_path
  ) then
    raise exception 'Media object is already queued for cleanup.' using errcode = '55000';
  end if;
  if coalesce(current_setting('pawbloom.account_deletion_rehome', true), '') <> 'on'
    and app_private.account_deletion_blocks_media(new.storage_path) then
    raise exception 'Account deletion is already in progress.' using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function public.list_account_deletion_registered_objects_v1(
  p_user_id uuid,
  p_limit integer default 100
)
returns table (bucket_id text, name text, media_asset_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select object.bucket_id, object.name, asset.id
  from storage.objects as object
  join public.media_assets as asset
    on object.bucket_id = 'pet-media'
   and asset.storage_path = object.name
  where object.owner_id = p_user_id::text
  order by object.bucket_id, object.name
  limit greatest(1, least(coalesce(p_limit, 100), 1000));
$$;

create or replace function public.begin_account_deletion_v1(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_pet_ids uuid[];
  result jsonb;
begin
  if p_user_id is null then
    raise exception 'A user ID is required.' using errcode = '22023';
  end if;

  -- SHARE conflicts with the ROW EXCLUSIVE lock taken by INSERT/UPDATE/DELETE.
  -- Waiting here drains already-running Storage/registration writers; the job
  -- row is then visible before blocked writers take a fresh statement snapshot.
  lock table storage.objects in share mode;
  lock table public.media_assets in share mode;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('account-deletion:' || p_user_id::text, 0)
  );
  select coalesce(array_agg(pet.id order by pet.id), array[]::uuid[])
    into current_pet_ids
  from public.pets as pet
  where pet.owner_id = p_user_id;

  insert into app_private.account_deletion_jobs (user_id, owned_pet_ids)
  values (p_user_id, current_pet_ids)
  on conflict (user_id) do nothing;

  update app_private.account_deletion_jobs as job
  set owned_pet_ids = (
        select coalesce(array_agg(distinct candidate.pet_id order by candidate.pet_id), array[]::uuid[])
        from unnest(job.owned_pet_ids || current_pet_ids) as candidate(pet_id)
      ),
      updated_at = now()
  where job.user_id = p_user_id
    and job.status = 'preparing';

  select jsonb_build_object(
    'job_id', job.job_id,
    'status', job.status,
    'owned_pet_ids', to_jsonb(job.owned_pet_ids)
  ) into result
  from app_private.account_deletion_jobs as job
  where job.user_id = p_user_id;
  return result;
end;
$$;

create or replace function public.get_account_deletion_job_v1(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'job_id', job.job_id,
    'status', job.status,
    'owned_pet_ids', to_jsonb(job.owned_pet_ids)
  )
  from app_private.account_deletion_jobs as job
  where job.user_id = p_user_id;
$$;

create or replace function public.list_account_deletion_objects_v1(
  p_user_id uuid,
  p_limit integer default 100
)
returns table (bucket_id text, name text, media_asset_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select object.bucket_id, object.name, asset.id
  from storage.objects as object
  left join public.media_assets as asset
    on object.bucket_id = 'pet-media'
   and asset.storage_path = object.name
  where object.owner_id = p_user_id::text
  order by object.bucket_id, object.name
  limit greatest(1, least(coalesce(p_limit, 100), 1000));
$$;

create or replace function public.rehome_account_deletion_media_v1(
  p_user_id uuid,
  p_media_asset_id uuid,
  p_source_path text,
  p_destination_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_pet_id uuid;
  target_job_id uuid;
begin
  select job.job_id into target_job_id
  from app_private.account_deletion_jobs as job
  where job.user_id = p_user_id and job.status = 'preparing';
  if not found then
    raise exception 'Account deletion job was not found.' using errcode = 'P0002';
  end if;

  select asset.pet_id into target_pet_id
  from public.media_assets as asset
  where asset.id = p_media_asset_id
    and asset.storage_path = p_source_path
  for update;
  if not found then
    raise exception 'Registered media was not found.' using errcode = 'P0002';
  end if;
  if p_source_path = p_destination_path
    or split_part(p_destination_path, '/', 1) <> target_pet_id::text
    or position('/.account-deletion/' || target_job_id::text || '/' in p_destination_path) = 0 then
    raise exception 'Invalid account-deletion media destination.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from storage.objects as source
    where source.bucket_id = 'pet-media'
      and source.name = p_source_path
      and source.owner_id = p_user_id::text
  ) then
    raise exception 'The source object is not owned by the deleting user.' using errcode = '55000';
  end if;
  if not exists (
    select 1 from storage.objects as destination
    where destination.bucket_id = 'pet-media'
      and destination.name = p_destination_path
      and destination.owner_id is null
  ) then
    raise exception 'The ownerless destination object was not found.' using errcode = '55000';
  end if;

  perform set_config('pawbloom.account_deletion_rehome', 'on', true);
  update public.media_assets as asset
  set storage_path = p_destination_path
  where asset.id = p_media_asset_id and asset.storage_path = p_source_path;
  if not found then
    raise exception 'Registered media changed during account deletion.' using errcode = '40001';
  end if;
  insert into app_private.account_deletion_media_rehomes (
    user_id, media_asset_id, source_path, destination_path
  ) values (
    p_user_id, p_media_asset_id, p_source_path, p_destination_path
  );
end;
$$;

create or replace function public.list_account_deletion_rehomes_v1(p_user_id uuid)
returns table (media_asset_id uuid, source_path text, destination_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select rehome.media_asset_id, rehome.source_path, rehome.destination_path
  from app_private.account_deletion_media_rehomes as rehome
  where rehome.user_id = p_user_id
  order by rehome.created_at, rehome.media_asset_id;
$$;

create or replace function public.rollback_account_deletion_rehome_v1(
  p_user_id uuid,
  p_media_asset_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target app_private.account_deletion_media_rehomes%rowtype;
begin
  select rehome.* into target
  from app_private.account_deletion_media_rehomes as rehome
  where rehome.user_id = p_user_id and rehome.media_asset_id = p_media_asset_id
  for update;
  if not found then
    raise exception 'Account deletion media re-home was not found.' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from storage.objects as source
    where source.bucket_id = 'pet-media'
      and source.name = target.source_path
      and source.owner_id = p_user_id::text
  ) or not exists (
    select 1 from storage.objects as destination
    where destination.bucket_id = 'pet-media'
      and destination.name = target.destination_path
      and destination.owner_id is null
  ) then
    raise exception 'Account deletion media rollback objects are incomplete.' using errcode = '55000';
  end if;

  perform set_config('pawbloom.account_deletion_rehome', 'on', true);
  update public.media_assets as asset
  set storage_path = target.source_path
  where asset.id = target.media_asset_id
    and asset.storage_path = target.destination_path;
  if not found then
    raise exception 'Registered media changed before account deletion rollback.' using errcode = '40001';
  end if;
  delete from app_private.account_deletion_media_rehomes as rehome
  where rehome.user_id = p_user_id and rehome.media_asset_id = p_media_asset_id;
  return target.destination_path;
end;
$$;

create or replace function public.list_account_deletion_temporary_objects_v1(p_user_id uuid)
returns table (bucket_id text, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select object.bucket_id, object.name
  from app_private.account_deletion_jobs as job
  join storage.objects as object
    on object.bucket_id = 'pet-media'
   and object.name like '%/.account-deletion/' || job.job_id::text || '/%'
  left join public.media_assets as asset on asset.storage_path = object.name
  where job.user_id = p_user_id
    and asset.id is null
  order by object.name;
$$;

create or replace function public.account_deletion_storage_state_v1(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'registered_user_owned_count', (
      select count(*)
      from storage.objects as object
      join public.media_assets as asset
        on object.bucket_id = 'pet-media' and asset.storage_path = object.name
      where object.owner_id = p_user_id::text
    ),
    'user_owned_count', (
      select count(*) from storage.objects as object
      where object.owner_id = p_user_id::text
    ),
    'owned_pet_object_count', (
      select count(*)
      from storage.objects as object
      where object.bucket_id = 'pet-media'
        and exists (
          select 1
          from app_private.account_deletion_jobs as job,
               unnest(job.owned_pet_ids) as captured(pet_id)
          where job.user_id = p_user_id
            and object.name like captured.pet_id::text || '/%'
        )
    ),
    'temporary_object_count', (
      select count(*)
      from app_private.account_deletion_jobs as job
      join storage.objects as object
        on object.bucket_id = 'pet-media'
       and object.name like '%/.account-deletion/' || job.job_id::text || '/%'
      left join public.media_assets as asset on asset.storage_path = object.name
      where job.user_id = p_user_id and asset.id is null
    )
  );
$$;

create or replace function public.list_pending_account_deletion_jobs_v1(p_limit integer default 25)
returns table (
  user_id uuid,
  job_id uuid,
  status text,
  owned_pet_ids uuid[],
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select job.user_id, job.job_id, job.status, job.owned_pet_ids, job.updated_at
  from app_private.account_deletion_jobs as job
  order by job.updated_at, job.requested_at
  limit greatest(1, least(coalesce(p_limit, 25), 100));
$$;

create or replace function public.record_account_deletion_failure_v1(
  p_user_id uuid,
  p_error text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update app_private.account_deletion_jobs
  set cleanup_attempts = cleanup_attempts + 1,
      last_error = left(coalesce(p_error, 'Unknown cleanup failure'), 500),
      updated_at = now()
  where user_id = p_user_id;
$$;

create or replace function public.cancel_account_deletion_v1(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_job_id uuid;
begin
  if not exists (select 1 from auth.users as account where account.id = p_user_id) then
    raise exception 'A deleted account job cannot be cancelled.' using errcode = '55000';
  end if;
  select job.job_id into target_job_id
  from app_private.account_deletion_jobs as job
  where job.user_id = p_user_id and job.status = 'preparing'
  for update;
  if not found then
    raise exception 'Preparing account deletion job was not found.' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from app_private.account_deletion_media_rehomes as rehome
    where rehome.user_id = p_user_id
  ) or exists (
    select 1 from storage.objects as object
    where object.bucket_id = 'pet-media'
      and object.name like '%/.account-deletion/' || target_job_id::text || '/%'
  ) then
    raise exception 'Account deletion rollback is incomplete.' using errcode = '55000';
  end if;
  delete from app_private.account_deletion_jobs where user_id = p_user_id;
end;
$$;

create or replace function public.mark_account_deletion_auth_deleted_v1(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update app_private.account_deletion_jobs
  set status = 'auth_deleted', last_error = null, updated_at = now()
  where user_id = p_user_id;
  if not found then
    raise exception 'Account deletion job was not found.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.complete_account_deletion_v1(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  state jsonb;
begin
  if not exists (
    select 1 from app_private.account_deletion_jobs as job
    where job.user_id = p_user_id and job.status = 'auth_deleted'
  ) then
    raise exception 'Account deletion is not ready to complete.' using errcode = '55000';
  end if;
  select public.account_deletion_storage_state_v1(p_user_id) into state;
  if coalesce((state ->> 'user_owned_count')::bigint, 0) <> 0
    or coalesce((state ->> 'owned_pet_object_count')::bigint, 0) <> 0
    or coalesce((state ->> 'temporary_object_count')::bigint, 0) <> 0 then
    raise exception 'Account deletion Storage cleanup is incomplete.' using errcode = '55000';
  end if;
  delete from app_private.account_deletion_jobs where user_id = p_user_id;
end;
$$;

create or replace function app_private.request_account_deletion_cleanup_v1()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  functions_url text;
  service_key text;
  worker_secret text;
begin
  select secret.decrypted_secret into functions_url
  from vault.decrypted_secrets as secret
  where secret.name = 'pawbloom_functions_url'
  limit 1;
  select secret.decrypted_secret into service_key
  from vault.decrypted_secrets as secret
  where secret.name = 'pawbloom_service_role_key'
  limit 1;
  select secret.decrypted_secret into worker_secret
  from vault.decrypted_secrets as secret
  where secret.name = 'pawbloom_account_deletion_worker_secret'
  limit 1;
  if functions_url is null or service_key is null or worker_secret is null then
    return;
  end if;

  perform net.http_post(
    url := rtrim(functions_url, '/') || '/functions/v1/delete-account',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key,
      'x-pawbloom-account-deletion-worker', worker_secret
    ),
    body := jsonb_build_object('action', 'drain'),
    timeout_milliseconds := 10000
  );
end;
$$;

revoke execute on function public.begin_account_deletion_v1(uuid)
  from public, anon, authenticated;

revoke execute on function public.get_account_deletion_job_v1(uuid)
  from public, anon, authenticated;

revoke execute on function public.list_account_deletion_registered_objects_v1(uuid, integer)
  from public, anon, authenticated;

revoke execute on function public.list_account_deletion_objects_v1(uuid, integer)
  from public, anon, authenticated;

revoke execute on function public.rehome_account_deletion_media_v1(uuid, uuid, text, text)
  from public, anon, authenticated;

revoke execute on function public.list_account_deletion_rehomes_v1(uuid)
  from public, anon, authenticated;

revoke execute on function public.rollback_account_deletion_rehome_v1(uuid, uuid)
  from public, anon, authenticated;

revoke execute on function public.list_account_deletion_temporary_objects_v1(uuid)
  from public, anon, authenticated;

revoke execute on function public.account_deletion_storage_state_v1(uuid)
  from public, anon, authenticated;

revoke execute on function public.list_pending_account_deletion_jobs_v1(integer)
  from public, anon, authenticated;

revoke execute on function public.record_account_deletion_failure_v1(uuid, text)
  from public, anon, authenticated;

revoke execute on function public.cancel_account_deletion_v1(uuid)
  from public, anon, authenticated;

revoke execute on function public.mark_account_deletion_auth_deleted_v1(uuid)
  from public, anon, authenticated;

revoke execute on function public.complete_account_deletion_v1(uuid)
  from public, anon, authenticated;

revoke execute on function app_private.request_account_deletion_cleanup_v1()
  from public, anon, authenticated;

grant execute on function public.begin_account_deletion_v1(uuid) to service_role;

grant execute on function public.get_account_deletion_job_v1(uuid) to service_role;

grant execute on function public.list_account_deletion_registered_objects_v1(uuid, integer) to service_role;

grant execute on function public.list_account_deletion_objects_v1(uuid, integer) to service_role;

grant execute on function public.rehome_account_deletion_media_v1(uuid, uuid, text, text) to service_role;

grant execute on function public.list_account_deletion_rehomes_v1(uuid) to service_role;

grant execute on function public.rollback_account_deletion_rehome_v1(uuid, uuid) to service_role;

grant execute on function public.list_account_deletion_temporary_objects_v1(uuid) to service_role;

grant execute on function public.account_deletion_storage_state_v1(uuid) to service_role;

grant execute on function public.list_pending_account_deletion_jobs_v1(integer) to service_role;

grant execute on function public.record_account_deletion_failure_v1(uuid, text) to service_role;

grant execute on function public.cancel_account_deletion_v1(uuid) to service_role;

grant execute on function public.mark_account_deletion_auth_deleted_v1(uuid) to service_role;

grant execute on function public.complete_account_deletion_v1(uuid) to service_role;

grant execute on function app_private.request_account_deletion_cleanup_v1() to service_role;

do $$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select job.jobid from cron.job as job
    where job.jobname = 'pawbloom-account-deletion-cleanup'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;
end;
$$;

select cron.schedule(
  'pawbloom-account-deletion-cleanup',
  '* * * * *',
  $cron$select app_private.request_account_deletion_cleanup_v1()$cron$
);
