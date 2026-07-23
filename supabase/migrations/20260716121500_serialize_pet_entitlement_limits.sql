-- The RLS count check is useful for fast rejection, but concurrent inserts can
-- both observe the same pre-insert count. Serialize pet creation per owner and
-- recheck the effective entitlement inside the write transaction.

create or replace function app_private.enforce_pet_entitlement_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pet_limit integer;
  owned_pet_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('pet-entitlement:' || new.owner_id::text, 0)
  );

  pet_limit := case app_private.effective_subscription_plan(new.owner_id)
    when 'free'::public.subscription_plan then 1
    when 'plus'::public.subscription_plan then 5
    when 'family'::public.subscription_plan then 10
  end;

  select count(*)
  into owned_pet_count
  from public.pets pet
  where pet.owner_id = new.owner_id;

  if owned_pet_count >= pet_limit then
    raise exception using
      errcode = 'P0001',
      message = 'pet_plan_limit_reached';
  end if;

  return new;
end;
$$;

revoke all on function app_private.enforce_pet_entitlement_limit() from public;

drop trigger if exists pets_enforce_entitlement_limit on public.pets;
create trigger pets_enforce_entitlement_limit
before insert on public.pets
for each row
execute function app_private.enforce_pet_entitlement_limit();
