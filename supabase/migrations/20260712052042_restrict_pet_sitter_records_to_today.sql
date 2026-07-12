alter policy "medication_doses care team insert" on public.medication_doses
with check (
  (pg_catalog.timezone('Australia/Sydney', scheduled_at))::date = dose_date
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
      and dose_date = (pg_catalog.timezone('Australia/Sydney', pg_catalog.now()))::date
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
    and dose_date = (pg_catalog.timezone('Australia/Sydney', pg_catalog.now()))::date
  )
)
with check (
  (pg_catalog.timezone('Australia/Sydney', scheduled_at))::date = dose_date
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
      and dose_date = (pg_catalog.timezone('Australia/Sydney', pg_catalog.now()))::date
    )
  )
);
