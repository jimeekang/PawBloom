-- Run with a privileged SQL connection after applying migrations. Every fixture
-- is transaction-local and rolls back. Assertions execute as real API roles.
begin;

create temporary table pet_returning_fixture on commit drop as
select gen_random_uuid() as owner_id, gen_random_uuid() as outsider_id,
  gen_random_uuid() as caregiver_id, gen_random_uuid() as expired_member_id,
  gen_random_uuid() as pet_id;
grant select on pet_returning_fixture to authenticated, anon;

insert into auth.users (id, email)
select fixture_user.id, 'pet-returning-' || fixture_user.id::text || '@example.test'
from pet_returning_fixture fixture
cross join lateral unnest(array[
  fixture.owner_id, fixture.outsider_id, fixture.caregiver_id, fixture.expired_member_id
]) fixture_user(id);

set local role authenticated;
select set_config('request.jwt.claim.sub', owner_id::text, true)
from pet_returning_fixture;

do $$
declare
  fixture record;
  returned_pet_id uuid;
begin
  select * into fixture from pet_returning_fixture;
  insert into public.pets (id, owner_id, name, species, weight_kg)
  values (fixture.pet_id, fixture.owner_id, 'Onboarding regression', 'dog', 3.5)
  returning id into returned_pet_id;
  if returned_pet_id is distinct from fixture.pet_id then
    raise exception 'first owned pet INSERT RETURNING must return the inserted row';
  end if;
  if (select count(*) from public.pet_members where pet_id = fixture.pet_id
      and user_id = fixture.owner_id and role = 'owner') <> 1 then
    raise exception 'pet creation must retain the canonical owner membership';
  end if;

  begin
    insert into public.pets (owner_id, name, species)
    values (fixture.owner_id, 'Over free limit', 'dog');
    raise exception 'second free pet unexpectedly allowed';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'pet_plan_limit_reached' then raise; end if;
  end;

  begin
    insert into public.pets (owner_id, name, species)
    values (fixture.outsider_id, 'Forged owner', 'dog');
    raise exception 'forged ownership unexpectedly allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
insert into public.pet_members (pet_id, user_id, role, starts_at, ends_at)
select pet_id, caregiver_id, 'caregiver'::public.pet_member_role, now() - interval '1 day', null
from pet_returning_fixture
union all
select pet_id, expired_member_id, 'pet_sitter'::public.pet_member_role, now() - interval '2 days', now() - interval '1 day'
from pet_returning_fixture;

set local role authenticated;
select set_config('request.jwt.claim.sub', caregiver_id::text, true)
from pet_returning_fixture;
do $$
declare affected integer;
begin
  if (select count(*) from public.pets where id = (select pet_id from pet_returning_fixture)) <> 1 then
    raise exception 'active caregiver must retain SELECT access';
  end if;
  update public.pets set name = 'Forbidden edit'
  where id = (select pet_id from pet_returning_fixture);
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'caregiver must not update the pet profile'; end if;
  begin
    delete from public.pets where id = (select pet_id from pet_returning_fixture);
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'caregiver must not delete the pet profile'; end if;
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', outsider_id::text, true)
from pet_returning_fixture;
do $$
begin
  if exists (select 1 from public.pets where id = (select pet_id from pet_returning_fixture)) then
    raise exception 'unrelated account must not read the pet';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', expired_member_id::text, true)
from pet_returning_fixture;
do $$
begin
  if exists (select 1 from public.pets where id = (select pet_id from pet_returning_fixture)) then
    raise exception 'expired member must not read the pet';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $$
begin
  begin
    if exists (select 1 from public.pets where id = (select pet_id from pet_returning_fixture)) then
      raise exception 'anonymous client must not read the pet';
    end if;
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;
select 'pet owner INSERT RETURNING and access isolation assertions passed' as result;
