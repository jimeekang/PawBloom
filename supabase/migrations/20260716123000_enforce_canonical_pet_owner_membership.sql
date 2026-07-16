-- pets.owner_id is the canonical single owner. Earlier owner-managed policies
-- allowed an owner to add another membership with role='owner', so normalize
-- legacy rows and prevent role drift before relying on owner-only operations.

update public.pet_members membership
set role = 'caregiver'::public.pet_member_role
from public.pets pet
where membership.pet_id = pet.id
  and membership.role = 'owner'::public.pet_member_role
  and membership.user_id <> pet.owner_id;

insert into public.pet_members (pet_id, user_id, role, starts_at, ends_at)
select pet.id, pet.owner_id, 'owner'::public.pet_member_role, null, null
from public.pets pet
on conflict (pet_id, user_id) do update
set role = 'owner'::public.pet_member_role,
    starts_at = null,
    ends_at = null;

create unique index if not exists pet_members_one_owner_idx
on public.pet_members (pet_id)
where role = 'owner'::public.pet_member_role;

create or replace function app_private.enforce_canonical_pet_member_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  canonical_owner_id uuid;
begin
  select pet.owner_id
  into canonical_owner_id
  from public.pets pet
  where pet.id = new.pet_id;

  if new.user_id = canonical_owner_id and new.role <> 'owner'::public.pet_member_role then
    raise exception using errcode = 'P0001', message = 'canonical_owner_role_required';
  end if;

  if new.user_id <> canonical_owner_id and new.role = 'owner'::public.pet_member_role then
    raise exception using errcode = 'P0001', message = 'owner_role_must_match_pet_owner';
  end if;

  return new;
end;
$$;

revoke all on function app_private.enforce_canonical_pet_member_role() from public;

drop trigger if exists pet_members_enforce_canonical_owner on public.pet_members;
create trigger pet_members_enforce_canonical_owner
before insert or update of pet_id, user_id, role on public.pet_members
for each row
execute function app_private.enforce_canonical_pet_member_role();
