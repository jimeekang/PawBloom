-- INSERT ... RETURNING checks SELECT visibility before the AFTER INSERT owner
-- membership is visible. The canonical owner_id is already checked by INSERT
-- RLS and allows the creator to read this row in the same statement.
-- Keep active membership access and all write/entitlement policies unchanged.
alter policy "pets members select"
on public.pets
using (
  owner_id = (select auth.uid())
  or app_private.is_pet_member(id, (select auth.uid()))
);
