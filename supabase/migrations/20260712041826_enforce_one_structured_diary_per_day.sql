alter table public.diary_entries
  add column superseded_by uuid;

alter table public.diary_entries
  add constraint diary_entries_superseded_by_fkey
  foreign key (superseded_by)
  references public.diary_entries(id)
  on delete cascade;

with ranked as (
  select
    de.id,
    first_value(de.id) over (
      partition by de.pet_id, de.entry_date, de.category
      order by de.updated_at desc, de.created_at desc, de.id desc
    ) as canonical_id,
    row_number() over (
      partition by de.pet_id, de.entry_date, de.category
      order by de.updated_at desc, de.created_at desc, de.id desc
    ) as position
  from public.diary_entries de
  where de.category in ('food', 'water', 'walk', 'stool', 'condition')
)
update public.diary_entries de
set superseded_by = ranked.canonical_id
from ranked
where de.id = ranked.id and ranked.position > 1;

create unique index diary_entries_one_active_structured_category_per_day
  on public.diary_entries (pet_id, entry_date, category)
  where superseded_by is null
    and category in ('food', 'water', 'walk', 'stool', 'condition');

alter policy "diary_entries member select" on public.diary_entries
using (
  superseded_by is null
  and app_private.is_pet_member(pet_id, (select auth.uid()))
);

alter policy "diary_entries care team insert" on public.diary_entries
with check (
  superseded_by is null
  and category <> 'photo'
  and (pg_catalog.timezone('Australia/Sydney', occurred_at))::date = entry_date
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
      and entry_date = (pg_catalog.timezone('Australia/Sydney', pg_catalog.now()))::date
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
  and (pg_catalog.timezone('Australia/Sydney', occurred_at))::date = entry_date
  and app_private.has_pet_role(
    pet_id,
    (select auth.uid()),
    array['owner','caregiver']::public.pet_member_role[]
  )
);

alter policy "diary_entries owner delete" on public.diary_entries
using (
  superseded_by is null
  and app_private.has_pet_role(
    pet_id,
    (select auth.uid()),
    array['owner']::public.pet_member_role[]
  )
);

revoke insert, update on table public.diary_entries from authenticated;
grant insert (
  pet_id,
  created_by,
  category,
  entry_date,
  occurred_at,
  summary,
  condition_score,
  client_mutation_id,
  record_origin
) on table public.diary_entries to authenticated;
grant update (
  occurred_at,
  summary,
  condition_score,
  record_origin,
  updated_at
) on table public.diary_entries to authenticated;
