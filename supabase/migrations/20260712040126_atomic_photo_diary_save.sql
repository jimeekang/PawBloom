create or replace function app_private.create_photo_diary_entry(
  p_entry_id uuid,
  p_pet_id uuid,
  p_entry_date date,
  p_occurred_at timestamptz,
  p_summary text,
  p_client_mutation_id uuid,
  p_media jsonb
)
returns public.diary_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_actor_user_id uuid := (select auth.uid());
  can_manage_any_date boolean;
  can_add_today boolean;
  existing_entry public.diary_entries;
  created_entry public.diary_entries;
  media_item jsonb;
  media_path text;
  media_content_type text;
  media_paths text[] := array[]::text[];
begin
  if current_actor_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  can_manage_any_date := app_private.has_pet_role(
    p_pet_id,
    current_actor_user_id,
    array['owner','caregiver']::public.pet_member_role[]
  );
  can_add_today := app_private.has_pet_role(
    p_pet_id,
    current_actor_user_id,
    array['pet_sitter']::public.pet_member_role[]
  ) and p_entry_date = (pg_catalog.timezone('Australia/Sydney', pg_catalog.now()))::date;
  if not can_manage_any_date and not can_add_today then
    raise exception 'Only the pet care team can save diary photos.' using errcode = '42501';
  end if;

  if p_entry_id is null or p_client_mutation_id is null or p_entry_date is null or p_occurred_at is null then
    raise exception 'Photo diary identifiers and time are required.' using errcode = '22023';
  end if;
  if (pg_catalog.timezone('Australia/Sydney', p_occurred_at))::date <> p_entry_date then
    raise exception 'Photo diary date and time do not match.' using errcode = '22023';
  end if;
  if p_media is null or jsonb_typeof(p_media) <> 'array' or jsonb_array_length(p_media) < 1 or jsonb_array_length(p_media) > 5 then
    raise exception 'Photo diary entries require between one and five photos.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_summary, '')) > 2000 then
    raise exception 'Photo diary summary is too long.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('photo-diary:' || p_pet_id::text || ':' || p_client_mutation_id::text, 0)
  );

  select de.* into existing_entry
  from public.diary_entries de
  where de.pet_id = p_pet_id and de.client_mutation_id = p_client_mutation_id;
  if found then
    if existing_entry.id <> p_entry_id
      or existing_entry.category <> 'photo'
      or existing_entry.created_by <> current_actor_user_id then
      raise exception 'Photo diary mutation id conflicts with another record.' using errcode = '22023';
    end if;
    return existing_entry;
  end if;

  for media_item in select value from jsonb_array_elements(p_media)
  loop
    media_path := nullif(media_item ->> 'storage_path', '');
    media_content_type := nullif(media_item ->> 'content_type', '');
    if media_path is null
      or media_path not like p_pet_id::text || '/diary/' || p_entry_id::text || '/%'
      or media_content_type not in ('image/jpeg', 'image/png', 'image/webp') then
      raise exception 'Invalid photo diary media metadata.' using errcode = '22023';
    end if;
    if media_path = any(media_paths) then
      raise exception 'Duplicate photo diary storage path.' using errcode = '22023';
    end if;
    if not exists (
      select 1 from storage.objects so
      where so.bucket_id = 'pet-media'
        and so.name = media_path
        and so.owner_id = current_actor_user_id::text
    ) then
      raise exception 'Uploaded photo object was not found for this user.' using errcode = '22023';
    end if;
    media_paths := array_append(media_paths, media_path);
  end loop;

  insert into public.diary_entries (
    id, pet_id, created_by, category, entry_date, occurred_at,
    summary, condition_score, client_mutation_id, record_origin
  ) values (
    p_entry_id, p_pet_id, current_actor_user_id, 'photo', p_entry_date, p_occurred_at,
    coalesce(p_summary, ''), null, p_client_mutation_id, 'diary'
  ) returning * into created_entry;

  for media_item in select value from jsonb_array_elements(p_media)
  loop
    insert into public.media_assets (
      pet_id, diary_entry_id, storage_path, content_type, created_by
    ) values (
      p_pet_id,
      created_entry.id,
      media_item ->> 'storage_path',
      media_item ->> 'content_type',
      current_actor_user_id
    );
  end loop;

  return created_entry;
end;
$$;

create or replace function public.create_photo_diary_entry(
  p_entry_id uuid,
  p_pet_id uuid,
  p_entry_date date,
  p_occurred_at timestamptz,
  p_summary text,
  p_client_mutation_id uuid,
  p_media jsonb
)
returns public.diary_entries
language sql
security invoker
set search_path = ''
as $$
  select app_private.create_photo_diary_entry(
    p_entry_id,
    p_pet_id,
    p_entry_date,
    p_occurred_at,
    p_summary,
    p_client_mutation_id,
    p_media
  );
$$;

drop policy if exists "pet media uploader update" on storage.objects;
create policy "pet media uploader update"
on storage.objects for update to authenticated
using (
  bucket_id = 'pet-media'
  and owner_id = (select auth.uid())::text
  and app_private.is_pet_member(((storage.foldername(name))[1])::uuid, (select auth.uid()))
)
with check (
  bucket_id = 'pet-media'
  and owner_id = (select auth.uid())::text
  and app_private.is_pet_member(((storage.foldername(name))[1])::uuid, (select auth.uid()))
);

drop policy if exists "pet media uploader delete" on storage.objects;
create policy "pet media uploader delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'pet-media'
  and owner_id = (select auth.uid())::text
  and app_private.is_pet_member(((storage.foldername(name))[1])::uuid, (select auth.uid()))
);

revoke execute on function app_private.create_photo_diary_entry(uuid, uuid, date, timestamptz, text, uuid, jsonb) from public, anon;
grant usage on schema app_private to authenticated;
grant execute on function app_private.create_photo_diary_entry(uuid, uuid, date, timestamptz, text, uuid, jsonb) to authenticated;

revoke execute on function public.create_photo_diary_entry(uuid, uuid, date, timestamptz, text, uuid, jsonb) from public, anon;
grant execute on function public.create_photo_diary_entry(uuid, uuid, date, timestamptz, text, uuid, jsonb) to authenticated;
