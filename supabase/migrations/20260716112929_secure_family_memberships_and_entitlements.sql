create unique index if not exists profiles_email_lower_unique_idx
on public.profiles (lower(email))
where email is not null;

drop policy if exists "pet_members owners insert" on public.pet_members;
drop policy if exists "pet_members owners update" on public.pet_members;
drop policy if exists "pet_members owners delete" on public.pet_members;

revoke insert, update, delete on public.pet_members from authenticated;
grant select on public.pet_members to authenticated;
grant select, insert, update, delete on public.pet_members to service_role;
grant select on public.profiles to service_role;
grant select, insert on public.audit_events to service_role;

drop policy if exists "subscription own insert" on public.subscription_entitlements;
drop policy if exists "subscription own update" on public.subscription_entitlements;

revoke insert, update, delete on public.subscription_entitlements from authenticated;
grant select on public.subscription_entitlements to authenticated;
grant select, insert, update, delete on public.subscription_entitlements to service_role;

insert into public.subscription_entitlements (user_id, plan, source)
select profile.id, 'free'::public.subscription_plan, 'bootstrap'
from public.profiles profile
on conflict (user_id) do nothing;

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  insert into public.subscription_entitlements (user_id, plan, source)
  values (new.id, 'free'::public.subscription_plan, 'signup')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace function app_private.effective_subscription_plan(target_user_id uuid)
returns public.subscription_plan
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select entitlement.plan
      from public.subscription_entitlements entitlement
      where entitlement.user_id = target_user_id
        and (entitlement.active_until is null or entitlement.active_until >= now())
      limit 1
    ),
    'free'::public.subscription_plan
  );
$$;

create or replace function app_private.can_create_pet(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    select count(*)
    from public.pets pet
    where pet.owner_id = target_user_id
  ) < case app_private.effective_subscription_plan(target_user_id)
    when 'free'::public.subscription_plan then 1
    when 'plus'::public.subscription_plan then 5
    when 'family'::public.subscription_plan then 10
  end;
$$;

revoke all on function app_private.effective_subscription_plan(uuid) from public;
revoke all on function app_private.can_create_pet(uuid) from public;
grant execute on function app_private.effective_subscription_plan(uuid) to authenticated, service_role;
grant execute on function app_private.can_create_pet(uuid) to authenticated, service_role;

drop policy if exists "pets owner insert" on public.pets;
create policy "pets owner insert"
on public.pets
for insert
to authenticated
with check (
  (select auth.uid()) = owner_id
  and app_private.can_create_pet((select auth.uid()))
);

drop policy if exists "pets owners update" on public.pets;
create policy "pets owners update"
on public.pets
for update
to authenticated
using (
  app_private.has_pet_role(id, (select auth.uid()), array['owner']::public.pet_member_role[])
)
with check (
  owner_id = (select auth.uid())
  and app_private.has_pet_role(id, (select auth.uid()), array['owner']::public.pet_member_role[])
);
