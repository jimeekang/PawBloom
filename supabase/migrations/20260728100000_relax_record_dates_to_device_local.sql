-- The client stamps entry_date/dose_date from the device's local calendar and
-- occurred_at/scheduled_at from the device's local wall clock. Earlier policies
-- re-derived the date in a fixed zone (Australia/Sydney), which rejected every
-- evening save from zones east of Sydney: Seoul 23:30 is already "tomorrow" in
-- Sydney, so the equality check failed and the insert was denied.
--
-- The server cannot know the device timezone, so instead of re-deriving the
-- date it now accepts any (timestamp, date) pairing that a real UTC offset
-- (-12..+14) could produce. The device calendar stays the authority; the check
-- only rejects pairings no timezone on Earth could generate.
create or replace function app_private.matches_local_entry_date(
  p_occurred_at timestamptz,
  p_entry_date date
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_occurred_at is not null
    and p_entry_date is not null
    -- local midnight at UTC+14 is the earliest instant of that local date...
    and p_occurred_at >= (p_entry_date::timestamp - interval '14 hours') at time zone 'UTC'
    -- ...and local 24:00 at UTC-12 is the latest instant before the next one.
    and p_occurred_at < ((p_entry_date + 1)::timestamp + interval '12 hours') at time zone 'UTC';
$$;

revoke execute on function app_private.matches_local_entry_date(timestamptz, date) from public, anon;
grant usage on schema app_private to authenticated;
grant execute on function app_private.matches_local_entry_date(timestamptz, date) to authenticated;

-- Diary: date/time consistency + pet-sitter "today" both move to the window
-- check. Passing now() as the timestamp asks "could this date currently be
-- 'today' on some real device?" — the closest server-side approximation of the
-- old today-only rule that does not lock sitters to one hemisphere.
alter policy "diary_entries care team insert" on public.diary_entries
with check (
  superseded_by is null
  and category <> 'photo'
  and app_private.matches_local_entry_date(occurred_at, entry_date)
  and (
    app_private.has_pet_role(
      pet_id,
      (select auth.uid()),
      array['owner','caregiver']::public.pet_member_role[]
    )
    or (
      app_private.has_pet_role(
        pet_id,
        (select auth.uid()),
        array['pet_sitter']::public.pet_member_role[]
      )
      and app_private.matches_local_entry_date(pg_catalog.now(), entry_date)
    )
  )
  and created_by = (select auth.uid())
);

alter policy "diary_entries care team update" on public.diary_entries
using (
  superseded_by is null
  and app_private.has_pet_role(
    pet_id,
    (select auth.uid()),
    array['owner','caregiver']::public.pet_member_role[]
  )
)
with check (
  superseded_by is null
  and app_private.matches_local_entry_date(occurred_at, entry_date)
  and app_private.has_pet_role(
    pet_id,
    (select auth.uid()),
    array['owner','caregiver']::public.pet_member_role[]
  )
);

-- Medication doses: same replacement for scheduled_at/dose_date and the
-- pet-sitter today restriction.
alter policy "medication_doses care team insert" on public.medication_doses
with check (
  app_private.matches_local_entry_date(scheduled_at, dose_date)
  and created_by = (select auth.uid())
  and (
    app_private.has_pet_role(
      pet_id,
      (select auth.uid()),
      array['owner','caregiver']::public.pet_member_role[]
    )
    or (
      app_private.has_pet_role(
        pet_id,
        (select auth.uid()),
        array['pet_sitter']::public.pet_member_role[]
      )
      and app_private.matches_local_entry_date(pg_catalog.now(), dose_date)
    )
  )
);

alter policy "medication_doses care team update" on public.medication_doses
using (
  app_private.has_pet_role(
    pet_id,
    (select auth.uid()),
    array['owner','caregiver']::public.pet_member_role[]
  )
  or (
    app_private.has_pet_role(
      pet_id,
      (select auth.uid()),
      array['pet_sitter']::public.pet_member_role[]
    )
    and app_private.matches_local_entry_date(pg_catalog.now(), dose_date)
  )
)
with check (
  app_private.matches_local_entry_date(scheduled_at, dose_date)
  and (
    app_private.has_pet_role(
      pet_id,
      (select auth.uid()),
      array['owner','caregiver']::public.pet_member_role[]
    )
    or (
      app_private.has_pet_role(
        pet_id,
        (select auth.uid()),
        array['pet_sitter']::public.pet_member_role[]
      )
      and app_private.matches_local_entry_date(pg_catalog.now(), dose_date)
    )
  )
);

-- Photo diary create: body identical to 20260712040126 except the two date
-- checks now use the device-local window.
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
  ) and app_private.matches_local_entry_date(pg_catalog.now(), p_entry_date);
  if not can_manage_any_date and not can_add_today then
    raise exception 'Only the pet care team can save diary photos.' using errcode = '42501';
  end if;

  if p_entry_id is null or p_client_mutation_id is null or p_entry_date is null or p_occurred_at is null then
    raise exception 'Photo diary identifiers and time are required.' using errcode = '22023';
  end if;
  if not app_private.matches_local_entry_date(p_occurred_at, p_entry_date) then
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

-- Photo diary append: body identical to 20260714021421 except the date check
-- now uses the device-local window.
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
  if not app_private.matches_local_entry_date(p_occurred_at, target_entry.entry_date) then
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
