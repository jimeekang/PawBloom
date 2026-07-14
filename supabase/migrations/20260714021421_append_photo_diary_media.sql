create or replace function app_private.update_photo_diary_entry(
  p_entry_id uuid,
  p_pet_id uuid,
  p_occurred_at timestamptz,
  p_append_mutation_id uuid,
  p_media jsonb
)
returns public.diary_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  target_entry public.diary_entries;
  media_item jsonb;
  media_path text;
  media_content_type text;
  existing_entry_id uuid;
  existing_content_type text;
  media_paths text[] := array[]::text[];
  daily_photo_count integer;
  new_photo_count integer := 0;
begin
  if actor_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if not app_private.has_pet_role(
    p_pet_id,
    actor_user_id,
    array['owner','caregiver']::public.pet_member_role[]
  ) then
    raise exception 'Only the pet owner or caregiver can update diary photos.' using errcode = '42501';
  end if;
  if p_entry_id is null or p_pet_id is null or p_occurred_at is null or p_append_mutation_id is null then
    raise exception 'Photo diary update identifiers and time are required.' using errcode = '22023';
  end if;
  if p_media is null or jsonb_typeof(p_media) <> 'array' or jsonb_array_length(p_media) > 5 then
    raise exception 'Photo diary updates accept up to five appended photos.' using errcode = '22023';
  end if;

  select entry.* into target_entry
  from public.diary_entries as entry
  where entry.id = p_entry_id and entry.pet_id = p_pet_id
  for update;
  if not found then
    raise exception 'Photo diary entry was not found.' using errcode = 'P0002';
  end if;
  if target_entry.category <> 'photo' then
    raise exception 'Only photo diary entries can append photos.' using errcode = '22023';
  end if;
  if (pg_catalog.timezone('Australia/Sydney', p_occurred_at))::date <> target_entry.entry_date then
    raise exception 'Photo diary date and time do not match.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('photo-diary-update:' || p_entry_id::text || ':' || p_append_mutation_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_pet_id::text || ':' || target_entry.entry_date::text, 0)
  );

  select count(*) into daily_photo_count
  from public.media_assets as asset
  join public.diary_entries as entry on entry.id = asset.diary_entry_id
  where asset.pet_id = p_pet_id
    and asset.diary_entry_id is not null
    and entry.entry_date = target_entry.entry_date;

  for media_item in select value from jsonb_array_elements(p_media)
  loop
    media_path := nullif(media_item ->> 'storage_path', '');
    media_content_type := nullif(media_item ->> 'content_type', '');
    if media_path is null
      or media_path not like p_pet_id::text || '/diary/' || p_entry_id::text || '/' || p_append_mutation_id::text || '-%'
      or media_content_type not in ('image/jpeg', 'image/png', 'image/webp') then
      raise exception 'Invalid appended photo metadata.' using errcode = '22023';
    end if;
    if media_path = any(media_paths) then
      raise exception 'Duplicate appended photo path.' using errcode = '22023';
    end if;
    media_paths := array_append(media_paths, media_path);

    existing_entry_id := null;
    existing_content_type := null;
    select asset.diary_entry_id, asset.content_type
      into existing_entry_id, existing_content_type
    from public.media_assets as asset
    where asset.storage_path = media_path;
    if found then
      if existing_entry_id <> p_entry_id or existing_content_type <> media_content_type then
        raise exception 'Appended photo path conflicts with another media record.' using errcode = '22023';
      end if;
      continue;
    end if;

    if not exists (
      select 1 from storage.objects as object
      where object.bucket_id = 'pet-media'
        and object.name = media_path
        and object.owner_id = actor_user_id::text
    ) then
      raise exception 'Uploaded appended photo was not found for this user.' using errcode = '22023';
    end if;
    new_photo_count := new_photo_count + 1;
  end loop;

  if daily_photo_count + new_photo_count > 5 then
    raise exception 'Daily diary photo limit is 5.' using errcode = '23514';
  end if;

  update public.diary_entries as entry
  set occurred_at = p_occurred_at, updated_at = now(), record_origin = 'diary'
  where entry.id = p_entry_id
  returning entry.* into target_entry;

  for media_item in select value from jsonb_array_elements(p_media)
  loop
    media_path := media_item ->> 'storage_path';
    if not exists (
      select 1 from public.media_assets as asset
      where asset.storage_path = media_path
    ) then
      insert into public.media_assets (
        pet_id, diary_entry_id, storage_path, content_type, created_by
      ) values (
        p_pet_id,
        p_entry_id,
        media_path,
        media_item ->> 'content_type',
        actor_user_id
      );
    end if;
  end loop;

  return target_entry;
end;
$$;

create or replace function public.update_photo_diary_entry(
  p_entry_id uuid,
  p_pet_id uuid,
  p_occurred_at timestamptz,
  p_append_mutation_id uuid,
  p_media jsonb
)
returns public.diary_entries
language sql
security invoker
set search_path = ''
as $$
  select app_private.update_photo_diary_entry(
    p_entry_id,
    p_pet_id,
    p_occurred_at,
    p_append_mutation_id,
    p_media
  );
$$;

revoke execute on function app_private.update_photo_diary_entry(uuid, uuid, timestamptz, uuid, jsonb)
  from public, anon;
grant usage on schema app_private to authenticated;
grant execute on function app_private.update_photo_diary_entry(uuid, uuid, timestamptz, uuid, jsonb)
  to authenticated;

revoke execute on function public.update_photo_diary_entry(uuid, uuid, timestamptz, uuid, jsonb)
  from public, anon;
grant execute on function public.update_photo_diary_entry(uuid, uuid, timestamptz, uuid, jsonb)
  to authenticated;
