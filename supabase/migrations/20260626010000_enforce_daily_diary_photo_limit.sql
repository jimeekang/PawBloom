alter table public.diary_entries
  add constraint diary_entries_condition_score_category_check
  check (
    (category = 'condition' and condition_score is not null)
    or (category <> 'condition' and condition_score is null)
  );

create or replace function app_private.enforce_daily_diary_photo_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  target_entry_date date;
  existing_count int;
begin
  if new.diary_entry_id is null then
    return new;
  end if;

  select entry_date
  into target_entry_date
  from public.diary_entries
  where id = new.diary_entry_id
    and pet_id = new.pet_id;

  if target_entry_date is null then
    raise exception 'Diary photo must belong to the same pet diary entry'
      using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.pet_id::text || ':' || target_entry_date::text, 0));

  select count(*)
  into existing_count
  from public.media_assets asset
  join public.diary_entries entry on entry.id = asset.diary_entry_id
  where asset.pet_id = new.pet_id
    and asset.diary_entry_id is not null
    and entry.entry_date = target_entry_date;

  if existing_count >= 5 then
    raise exception 'Daily diary photo limit is 5'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function app_private.enforce_daily_diary_photo_limit() from public;

drop trigger if exists enforce_daily_diary_photo_limit on public.media_assets;
create trigger enforce_daily_diary_photo_limit
  before insert on public.media_assets
  for each row
  execute function app_private.enforce_daily_diary_photo_limit();
