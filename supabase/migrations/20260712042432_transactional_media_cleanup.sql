-- Persist media cleanup intent in the same transaction as metadata deletion.
-- Storage objects are removed through the Storage API after commit, and failed
-- removals remain queued for a later authenticated retry.
create table app_private.media_cleanup_jobs (
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, storage_path),
  check (storage_path <> '' and storage_path !~ '(^|/)\.\.(/|$)')
);

create index media_cleanup_jobs_storage_path_idx
  on app_private.media_cleanup_jobs (storage_path);

revoke all on table app_private.media_cleanup_jobs from public, anon, authenticated;

alter table public.media_assets
  drop constraint if exists media_assets_diary_entry_id_fkey;
alter table public.media_assets
  add constraint media_assets_diary_entry_id_fkey
  foreign key (diary_entry_id) references public.diary_entries(id) on delete cascade;

create or replace function app_private.queue_media_cleanup(
  actor_user_id uuid,
  storage_paths text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_path text;
begin
  for candidate_path in
    select distinct candidate.storage_path
    from unnest(coalesce(storage_paths, array[]::text[])) as candidate(storage_path)
    where actor_user_id is not null
      and candidate.storage_path <> ''
      and candidate.storage_path !~ '(^|/)\.\.(/|$)'
    order by candidate.storage_path
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('media-cleanup:' || candidate_path, 0)
    );
    insert into app_private.media_cleanup_jobs (user_id, storage_path)
    values (actor_user_id, candidate_path)
    on conflict (user_id, storage_path) do nothing;
  end loop;
end;
$$;

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
  return new;
end;
$$;

drop trigger if exists prevent_queued_media_registration on public.media_assets;
create trigger prevent_queued_media_registration
before insert or update of storage_path on public.media_assets
for each row execute function app_private.prevent_queued_media_registration();

create or replace function app_private.can_cleanup_media(target_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app_private.media_cleanup_jobs as job
    where job.user_id = (select auth.uid())
      and job.storage_path = target_storage_path
      and not exists (
        select 1
        from public.media_assets as registered
        where registered.storage_path = job.storage_path
      )
  );
$$;

create or replace function app_private.is_media_queued_for_cleanup(target_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app_private.media_cleanup_jobs as job
    where job.storage_path = target_storage_path
      and not exists (
        select 1
        from public.media_assets as registered
        where registered.storage_path = job.storage_path
      )
  );
$$;

create or replace function app_private.replace_pet_profile_photo_v1(
  p_pet_id uuid,
  p_storage_path text,
  p_content_type text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  cleanup_paths text[] := array[]::text[];
begin
  if actor_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if not app_private.has_pet_role(
    p_pet_id,
    actor_user_id,
    array['owner']::public.pet_member_role[]
  ) then
    raise exception 'Only the pet owner can replace the profile photo.' using errcode = '42501';
  end if;
  if p_storage_path not like p_pet_id::text || '/profile/%'
    or p_content_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'Invalid profile photo metadata.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('pet-profile-photo:' || p_pet_id::text));

  -- Keep the same pet -> media-path lock order used by delete_pet_v1. The
  -- explicit key-share lock is acquired before the media_assets trigger takes
  -- a path advisory lock, preventing a concurrent delete/replace deadlock.
  perform 1 from public.pets as pet
  where pet.id = p_pet_id
  for key share;
  if not found then
    raise exception 'Pet not found.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from storage.objects as object
    where object.bucket_id = 'pet-media'
      and object.name = p_storage_path
      and object.owner_id = actor_user_id::text
  ) then
    raise exception 'Uploaded profile photo was not found for this user.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.media_assets as asset
    where asset.pet_id = p_pet_id
      and asset.diary_entry_id is null
      and asset.storage_path = p_storage_path
  ) then
    select coalesce(array_agg(job.storage_path order by job.created_at, job.storage_path), array[]::text[])
      into cleanup_paths
    from app_private.media_cleanup_jobs as job
    where job.user_id = actor_user_id
      and job.storage_path like p_pet_id::text || '/profile/%';
    return jsonb_build_object(
      'record', jsonb_build_object('storage_path', p_storage_path),
      'cleanup_paths', to_jsonb(cleanup_paths)
    );
  end if;

  select coalesce(array_agg(candidate.storage_path order by candidate.storage_path), array[]::text[])
    into cleanup_paths
  from (
    select asset.storage_path
    from public.media_assets as asset
    where asset.pet_id = p_pet_id
      and asset.diary_entry_id is null
      and asset.storage_path like p_pet_id::text || '/profile/%'
      and asset.storage_path <> p_storage_path
    union
    select object.name
    from storage.objects as object
    where object.bucket_id = 'pet-media'
      and object.name like p_pet_id::text || '/profile/%'
      and object.name <> p_storage_path
      and object.created_at < now() - interval '1 hour'
      and not exists (
        select 1 from public.media_assets as registered
        where registered.storage_path = object.name
      )
  ) as candidate;

  insert into public.media_assets (
    pet_id, diary_entry_id, storage_path, content_type, created_by
  ) values (
    p_pet_id, null, p_storage_path, p_content_type, actor_user_id
  );

  perform app_private.queue_media_cleanup(actor_user_id, cleanup_paths);
  delete from public.media_assets as asset
  where asset.pet_id = p_pet_id
    and asset.diary_entry_id is null
    and asset.storage_path like p_pet_id::text || '/profile/%'
    and asset.storage_path <> p_storage_path;

  return jsonb_build_object(
    'record', jsonb_build_object('storage_path', p_storage_path),
    'cleanup_paths', to_jsonb(cleanup_paths)
  );
end;
$$;

create or replace function app_private.delete_diary_entry_v1(
  p_pet_id uuid,
  p_entry_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  target_entry public.diary_entries;
  cleanup_paths text[] := array[]::text[];
begin
  if actor_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if not app_private.has_pet_role(
    p_pet_id,
    actor_user_id,
    array['owner']::public.pet_member_role[]
  ) then
    raise exception 'Only the pet owner can delete diary entries.' using errcode = '42501';
  end if;

  select entry.* into target_entry
  from public.diary_entries as entry
  where entry.id = p_entry_id and entry.pet_id = p_pet_id
  for update;
  if not found then
    raise exception 'Diary entry not found.' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(candidate.storage_path order by candidate.storage_path), array[]::text[])
    into cleanup_paths
  from (
    select asset.storage_path
    from public.media_assets as asset
    where asset.pet_id = p_pet_id and asset.diary_entry_id = p_entry_id
    union
    select object.name
    from storage.objects as object
    where object.bucket_id = 'pet-media'
      and object.name like p_pet_id::text || '/diary/' || p_entry_id::text || '/%'
  ) as candidate;

  perform app_private.queue_media_cleanup(actor_user_id, cleanup_paths);
  delete from public.media_assets as asset
  where asset.pet_id = p_pet_id and asset.diary_entry_id = p_entry_id;
  delete from public.diary_entries as entry
  where entry.id = p_entry_id and entry.pet_id = p_pet_id;

  return jsonb_build_object(
    'record', to_jsonb(target_entry) || jsonb_build_object('media_assets', '[]'::jsonb),
    'cleanup_paths', to_jsonb(cleanup_paths)
  );
end;
$$;

create or replace function app_private.delete_pet_v1(p_pet_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  cleanup_paths text[] := array[]::text[];
  deleted_count integer;
begin
  if actor_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if not app_private.has_pet_role(
    p_pet_id,
    actor_user_id,
    array['owner']::public.pet_member_role[]
  ) then
    raise exception 'Only the pet owner can delete the pet.' using errcode = '42501';
  end if;

  perform 1 from public.pets as pet where pet.id = p_pet_id for update;
  if not found then
    raise exception 'Pet not found.' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(candidate.storage_path order by candidate.storage_path), array[]::text[])
    into cleanup_paths
  from (
    select asset.storage_path
    from public.media_assets as asset
    where asset.pet_id = p_pet_id
    union
    select object.name
    from storage.objects as object
    where object.bucket_id = 'pet-media'
      and object.name like p_pet_id::text || '/%'
  ) as candidate;

  perform app_private.queue_media_cleanup(actor_user_id, cleanup_paths);
  delete from public.pets as pet where pet.id = p_pet_id;
  get diagnostics deleted_count = row_count;
  if deleted_count <> 1 then
    raise exception 'Pet not found.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'record', jsonb_build_object('id', p_pet_id),
    'cleanup_paths', to_jsonb(cleanup_paths)
  );
end;
$$;

create or replace function app_private.list_pending_media_cleanup_v1()
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  orphan_paths text[] := array[]::text[];
  pending_paths text[];
begin
  if actor_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  -- Recover uploads left behind when the app exits before the atomic diary RPC
  -- commits. Only the current Storage owner can queue an aged object, and the
  -- user must still belong to the pet encoded in the path. Service-key uploads
  -- have no owner_id and are deliberately excluded from client-driven cleanup.
  select coalesce(array_agg(object.name order by object.name), array[]::text[])
    into orphan_paths
  from storage.objects as object
  join public.pets as pet
    on object.name like pet.id::text || '/diary/%'
  where object.bucket_id = 'pet-media'
    and object.owner_id is not null
    and object.owner_id = actor_user_id::text
    and object.created_at <= now() - interval '1 hour'
    and coalesce(object.updated_at, object.created_at) <= now() - interval '1 hour'
    and object.name ~ (
      '^' || pet.id::text
      || '/diary/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$'
    )
    and app_private.is_pet_member(pet.id, actor_user_id)
    and not exists (
      select 1
      from public.media_assets as registered
      where registered.storage_path = object.name
    );

  perform app_private.queue_media_cleanup(actor_user_id, orphan_paths);

  delete from app_private.media_cleanup_jobs as job
  where job.user_id = actor_user_id
    and (
      not exists (
        select 1 from storage.objects as object
        where object.bucket_id = 'pet-media' and object.name = job.storage_path
      )
      or exists (
        select 1 from public.media_assets as registered
        where registered.storage_path = job.storage_path
      )
    );

  select coalesce(array_agg(job.storage_path order by job.created_at, job.storage_path), array[]::text[])
    into pending_paths
  from app_private.media_cleanup_jobs as job
  where job.user_id = actor_user_id;
  return pending_paths;
end;
$$;

create or replace function app_private.complete_media_cleanup_v1(p_storage_paths text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  deleted_count integer;
begin
  if actor_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  delete from app_private.media_cleanup_jobs as job
  where job.user_id = actor_user_id
    and job.storage_path = any(coalesce(p_storage_paths, array[]::text[]))
    and (
      not exists (
        select 1 from storage.objects as object
        where object.bucket_id = 'pet-media' and object.name = job.storage_path
      )
      or exists (
        select 1 from public.media_assets as registered
        where registered.storage_path = job.storage_path
      )
    );
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

create or replace function public.replace_pet_profile_photo_v1(
  p_pet_id uuid,
  p_storage_path text,
  p_content_type text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app_private.replace_pet_profile_photo_v1(p_pet_id, p_storage_path, p_content_type);
$$;

create or replace function public.delete_diary_entry_v1(p_pet_id uuid, p_entry_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app_private.delete_diary_entry_v1(p_pet_id, p_entry_id);
$$;

create or replace function public.delete_pet_v1(p_pet_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app_private.delete_pet_v1(p_pet_id);
$$;

create or replace function public.list_pending_media_cleanup_v1()
returns text[]
language sql
security invoker
set search_path = ''
as $$
  select app_private.list_pending_media_cleanup_v1();
$$;

create or replace function public.complete_media_cleanup_v1(p_storage_paths text[])
returns integer
language sql
security invoker
set search_path = ''
as $$
  select app_private.complete_media_cleanup_v1(p_storage_paths);
$$;

drop policy if exists "pet media queued cleanup delete" on storage.objects;
create policy "pet media queued cleanup delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'pet-media'
  and app_private.can_cleanup_media(name)
);

-- Earlier permissive policies allowed a member to overwrite or remove an
-- object after it had been registered in media_assets. Registered objects must
-- first be detached and queued by a transactional metadata RPC.
drop policy if exists "pet media care team update" on storage.objects;
drop policy if exists "pet media uploader update" on storage.objects;
create policy "pet media unregistered uploader update"
on storage.objects for update to authenticated
using (
  bucket_id = 'pet-media'
  and owner_id = (select auth.uid())::text
  and app_private.is_pet_member(((storage.foldername(name))[1])::uuid, (select auth.uid()))
  and not exists (
    select 1 from public.media_assets as registered
    where registered.storage_path = name
  )
)
with check (
  bucket_id = 'pet-media'
  and owner_id = (select auth.uid())::text
  and app_private.is_pet_member(((storage.foldername(name))[1])::uuid, (select auth.uid()))
  and not exists (
    select 1 from public.media_assets as registered
    where registered.storage_path = name
  )
);

drop policy if exists "pet media owner delete" on storage.objects;
drop policy if exists "pet media uploader delete" on storage.objects;
create policy "pet media unregistered uploader delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'pet-media'
  and owner_id = (select auth.uid())::text
  and app_private.is_pet_member(((storage.foldername(name))[1])::uuid, (select auth.uid()))
  and not exists (
    select 1 from public.media_assets as registered
    where registered.storage_path = name
  )
);

drop policy if exists "pet media queued cleanup hidden" on storage.objects;
create policy "pet media queued cleanup hidden"
on storage.objects as restrictive for select to authenticated
using (
  bucket_id <> 'pet-media'
  or not app_private.is_media_queued_for_cleanup(name)
);

-- Force all destructive metadata changes through the queueing RPCs.
revoke delete on table public.pets from authenticated;
revoke delete on table public.diary_entries from authenticated;
revoke insert, delete on table public.media_assets from authenticated;

revoke execute on function app_private.queue_media_cleanup(uuid, text[]) from public, anon, authenticated;
revoke execute on function app_private.prevent_queued_media_registration() from public, anon, authenticated;
revoke execute on function app_private.can_cleanup_media(text) from public, anon;
revoke execute on function app_private.is_media_queued_for_cleanup(text) from public, anon;
revoke execute on function app_private.replace_pet_profile_photo_v1(uuid, text, text) from public, anon;
revoke execute on function app_private.delete_diary_entry_v1(uuid, uuid) from public, anon;
revoke execute on function app_private.delete_pet_v1(uuid) from public, anon;
revoke execute on function app_private.list_pending_media_cleanup_v1() from public, anon;
revoke execute on function app_private.complete_media_cleanup_v1(text[]) from public, anon;

grant usage on schema app_private to authenticated;
grant execute on function app_private.can_cleanup_media(text) to authenticated;
grant execute on function app_private.is_media_queued_for_cleanup(text) to authenticated;
grant execute on function app_private.replace_pet_profile_photo_v1(uuid, text, text) to authenticated;
grant execute on function app_private.delete_diary_entry_v1(uuid, uuid) to authenticated;
grant execute on function app_private.delete_pet_v1(uuid) to authenticated;
grant execute on function app_private.list_pending_media_cleanup_v1() to authenticated;
grant execute on function app_private.complete_media_cleanup_v1(text[]) to authenticated;

revoke execute on function public.replace_pet_profile_photo_v1(uuid, text, text) from public, anon;
revoke execute on function public.delete_diary_entry_v1(uuid, uuid) from public, anon;
revoke execute on function public.delete_pet_v1(uuid) from public, anon;
revoke execute on function public.list_pending_media_cleanup_v1() from public, anon;
revoke execute on function public.complete_media_cleanup_v1(text[]) from public, anon;
grant execute on function public.replace_pet_profile_photo_v1(uuid, text, text) to authenticated;
grant execute on function public.delete_diary_entry_v1(uuid, uuid) to authenticated;
grant execute on function public.delete_pet_v1(uuid) to authenticated;
grant execute on function public.list_pending_media_cleanup_v1() to authenticated;
grant execute on function public.complete_media_cleanup_v1(text[]) to authenticated;
