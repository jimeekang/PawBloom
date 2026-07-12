create table if not exists app_private.care_setup_mutations (
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  client_mutation_id uuid not null,
  pet_id uuid not null references public.pets(id) on delete cascade,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (actor_user_id, client_mutation_id)
);

-- Older clients allowed duplicate times for one medication. Keep the newest
-- schedule so the constraint can be installed on an existing project; dose
-- history remains intact and its deleted schedule reference becomes null.
with ranked_schedules as (
  select
    ms.id,
    row_number() over (
      partition by ms.medication_id, ms.local_time
      order by ms.created_at desc, ms.id desc
    ) as duplicate_rank
  from public.medication_schedules ms
)
delete from public.medication_schedules ms
using ranked_schedules ranked
where ms.id = ranked.id and ranked.duplicate_rank > 1;

alter table public.medication_schedules
  add constraint medication_schedules_medication_time_key
  unique (medication_id, local_time)
  deferrable initially deferred;

create or replace function app_private.care_setup_snapshot(
  target_pet_id uuid,
  primary_condition_id uuid,
  primary_plan_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'conditions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'status', c.status,
        'startsOn', c.starts_on,
        'endsOn', c.ends_on
      ) order by c.created_at desc)
      from public.conditions c
      where c.pet_id = target_pet_id and c.status = 'active'
    ), '[]'::jsonb),
    'condition', (
      select jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'status', c.status,
        'startsOn', c.starts_on,
        'endsOn', c.ends_on
      )
      from public.conditions c
      where c.id = primary_condition_id
        and c.pet_id = target_pet_id
        and c.status = 'active'
    ),
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cp.id,
        'conditionId', cp.condition_id,
        'title', cp.title,
        'instructions', cp.instructions,
        'startsOn', cp.starts_on,
        'endsOn', cp.ends_on
      ) order by cp.created_at desc)
      from public.care_plans cp
      where cp.pet_id = target_pet_id
    ), '[]'::jsonb),
    'plan', (
      select jsonb_build_object(
        'id', cp.id,
        'conditionId', cp.condition_id,
        'title', cp.title,
        'instructions', cp.instructions,
        'startsOn', cp.starts_on,
        'endsOn', cp.ends_on
      )
      from public.care_plans cp
      where cp.id = primary_plan_id and cp.pet_id = target_pet_id
    ),
    'schedules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ms.id,
        'medicationId', m.id,
        'medicationName', m.name,
        'dosageLabel', m.dosage_label,
        'conditionId', c.id,
        'conditionName', c.name,
        'localTime', ms.local_time,
        'startsOn', ms.starts_on,
        'endsOn', ms.ends_on,
        'recurrenceIntervalDays', ms.recurrence_interval_days
      ) order by m.created_at desc, ms.local_time asc)
      from public.medication_schedules ms
      join public.medications m on m.id = ms.medication_id and m.pet_id = target_pet_id
      left join public.conditions c on c.id = m.condition_id and c.pet_id = target_pet_id
      where ms.pet_id = target_pet_id
    ), '[]'::jsonb)
  );
$$;

create or replace function app_private.save_care_setup_v1(
  p_pet_id uuid,
  p_request jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_actor_user_id uuid := (select auth.uid());
  current_actor_is_owner boolean := false;
  request_version integer;
  mutation_id uuid;
  stored_pet_id uuid;
  stored_result jsonb;
  condition_requested_id uuid;
  plan_requested_id uuid;
  medication_requested_id uuid;
  selected_condition_id uuid;
  selected_plan_id uuid;
  selected_medication_id uuid;
  condition_name text := nullif(btrim(p_request #>> '{condition,name}'), '');
  plan_title text := nullif(btrim(p_request #>> '{plan,title}'), '');
  plan_instructions text := nullif(btrim(p_request #>> '{plan,instructions}'), '');
  medication_name text := nullif(btrim(p_request #>> '{medication,name}'), '');
  requested_dosage_label text := nullif(btrim(p_request #>> '{medication,dosageLabel}'), '');
  requested_starts_on date;
  requested_ends_on date;
  requested_recurrence_days integer;
  schedule_item jsonb;
  selected_schedule_id uuid;
  requested_schedule_time time;
  kept_schedule_ids uuid[] := array[]::uuid[];
  kept_schedule_times time[] := array[]::time[];
  response_result jsonb;
begin
  if current_actor_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if not app_private.has_pet_role(
    p_pet_id,
    current_actor_user_id,
    array['owner','caregiver']::public.pet_member_role[]
  ) then
    raise exception 'Only the pet care team can save care setup.' using errcode = '42501';
  end if;
  current_actor_is_owner := app_private.has_pet_role(
    p_pet_id,
    current_actor_user_id,
    array['owner']::public.pet_member_role[]
  );

  request_version := (p_request ->> 'version')::integer;
  mutation_id := (p_request ->> 'clientMutationId')::uuid;
  requested_starts_on := (p_request ->> 'startsOn')::date;
  requested_ends_on := nullif(p_request ->> 'endsOn', '')::date;
  requested_recurrence_days := (p_request ->> 'recurrenceIntervalDays')::integer;
  condition_requested_id := nullif(p_request #>> '{condition,id}', '')::uuid;
  plan_requested_id := nullif(p_request #>> '{plan,id}', '')::uuid;
  medication_requested_id := nullif(p_request #>> '{medication,id}', '')::uuid;

  if request_version <> 1 or mutation_id is null then
    raise exception 'Unsupported care setup request.' using errcode = '22023';
  end if;
  if requested_recurrence_days < 1 or (requested_ends_on is not null and requested_ends_on < requested_starts_on) then
    raise exception 'Invalid care schedule period.' using errcode = '22023';
  end if;
  if condition_name is null and plan_title is null and medication_name is null then
    raise exception 'At least one care setup value is required.' using errcode = '22023';
  end if;
  if coalesce(char_length(condition_name), 0) > 120
    or coalesce(char_length(plan_title), 0) > 120
    or coalesce(char_length(medication_name), 0) > 120
    or coalesce(char_length(requested_dosage_label), 0) > 120
    or coalesce(char_length(plan_instructions), 0) > 2000 then
    raise exception 'Care setup text is too long.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_pet_id::text, 0));

  select m.pet_id, m.result
    into stored_pet_id, stored_result
  from app_private.care_setup_mutations m
  where m.actor_user_id = current_actor_user_id and m.client_mutation_id = mutation_id;
  if found then
    if stored_pet_id <> p_pet_id then
      raise exception 'Mutation id belongs to a different pet.' using errcode = '22023';
    end if;
    return stored_result;
  end if;

  if condition_requested_id is not null then
    select c.id into selected_condition_id
    from public.conditions c
    where c.id = condition_requested_id and c.pet_id = p_pet_id
    for update;
    if not found then raise exception 'Condition does not belong to this pet.' using errcode = '22023'; end if;
  elsif condition_name is not null then
    select c.id into selected_condition_id
    from public.conditions c
    where c.pet_id = p_pet_id and lower(btrim(c.name)) = lower(condition_name)
    order by c.created_at desc
    limit 1
    for update;
  end if;

  if condition_name is not null then
    if selected_condition_id is null then
      insert into public.conditions (pet_id, name, status, starts_on, ends_on, created_by)
      values (p_pet_id, condition_name, 'active', requested_starts_on, requested_ends_on, current_actor_user_id)
      returning id into selected_condition_id;
    else
      update public.conditions
      set name = condition_name, status = 'active', starts_on = requested_starts_on,
          ends_on = requested_ends_on, updated_at = now()
      where id = selected_condition_id;
    end if;
  elsif selected_condition_id is not null then
    update public.conditions
    set status = 'resolved', ends_on = coalesce(requested_ends_on, requested_starts_on), updated_at = now()
    where id = selected_condition_id;
    selected_condition_id := null;
  end if;

  if plan_requested_id is not null then
    select cp.id into selected_plan_id
    from public.care_plans cp
    where cp.id = plan_requested_id
      and cp.pet_id = p_pet_id
      and (cp.condition_id is null or cp.condition_id is not distinct from selected_condition_id)
    for update;
    if not found then raise exception 'Care plan does not belong to this condition.' using errcode = '22023'; end if;
  elsif plan_title is not null then
    select cp.id into selected_plan_id
    from public.care_plans cp
    where cp.pet_id = p_pet_id
      and cp.condition_id is not distinct from selected_condition_id
      and lower(btrim(cp.title)) = lower(plan_title)
    order by cp.created_at desc
    limit 1
    for update;
  end if;

  if plan_title is not null then
    if selected_plan_id is null then
      insert into public.care_plans (pet_id, condition_id, title, instructions, starts_on, ends_on, created_by)
      values (p_pet_id, selected_condition_id, plan_title, plan_instructions, requested_starts_on, requested_ends_on, current_actor_user_id)
      returning id into selected_plan_id;
    else
      update public.care_plans
      set condition_id = selected_condition_id, title = plan_title, instructions = plan_instructions,
          starts_on = requested_starts_on, ends_on = requested_ends_on, updated_at = now()
      where id = selected_plan_id;
    end if;
  elsif selected_plan_id is not null then
    if not current_actor_is_owner then
      raise exception 'Only the pet owner can delete a care plan.' using errcode = '42501';
    end if;
    delete from public.care_plans where id = selected_plan_id;
    selected_plan_id := null;
  end if;

  if medication_requested_id is not null then
    select m.id into selected_medication_id
    from public.medications m
    where m.id = medication_requested_id and m.pet_id = p_pet_id
    for update;
    if not found then raise exception 'Medication does not belong to this pet.' using errcode = '22023'; end if;
  elsif medication_name is not null then
    select m.id into selected_medication_id
    from public.medications m
    where m.pet_id = p_pet_id and lower(btrim(m.name)) = lower(medication_name)
    order by m.created_at desc
    limit 1
    for update;
  end if;

  if medication_name is not null then
    if requested_dosage_label is null then
      raise exception 'Medication dosage is required.' using errcode = '22023';
    end if;
    if selected_medication_id is null then
      insert into public.medications (pet_id, condition_id, name, dosage_label, created_by)
      values (p_pet_id, selected_condition_id, medication_name, requested_dosage_label, current_actor_user_id)
      returning id into selected_medication_id;
    else
      update public.medications
      set condition_id = selected_condition_id, name = medication_name,
          dosage_label = requested_dosage_label, updated_at = now()
      where id = selected_medication_id;
    end if;
  end if;

  if selected_medication_id is not null and medication_name is not null then
    if jsonb_typeof(coalesce(p_request -> 'schedules', '[]'::jsonb)) <> 'array'
      or jsonb_array_length(coalesce(p_request -> 'schedules', '[]'::jsonb)) > 16 then
      raise exception 'Invalid care schedule list.' using errcode = '22023';
    end if;
    for schedule_item in
      select value from jsonb_array_elements(coalesce(p_request -> 'schedules', '[]'::jsonb))
    loop
      selected_schedule_id := nullif(schedule_item ->> 'id', '')::uuid;
      requested_schedule_time := (schedule_item ->> 'localTime')::time;
      if requested_schedule_time = any(kept_schedule_times) then
        raise exception 'Duplicate medication time.' using errcode = '22023';
      end if;

      if selected_schedule_id is not null then
        perform 1 from public.medication_schedules ms
        where ms.id = selected_schedule_id and ms.pet_id = p_pet_id and ms.medication_id = selected_medication_id
        for update;
        if not found then raise exception 'Medication schedule does not belong to this medication.' using errcode = '22023'; end if;
        update public.medication_schedules
        set local_time = requested_schedule_time, starts_on = requested_starts_on, ends_on = requested_ends_on,
            recurrence_interval_days = requested_recurrence_days
        where id = selected_schedule_id;
      else
        insert into public.medication_schedules (
          pet_id, medication_id, local_time, starts_on, ends_on,
          recurrence_interval_days, created_by
        ) values (
          p_pet_id, selected_medication_id, requested_schedule_time, requested_starts_on, requested_ends_on,
          requested_recurrence_days, current_actor_user_id
        ) returning id into selected_schedule_id;
      end if;
      kept_schedule_ids := array_append(kept_schedule_ids, selected_schedule_id);
      kept_schedule_times := array_append(kept_schedule_times, requested_schedule_time);
    end loop;

    if cardinality(kept_schedule_ids) = 0 then
      if exists (
        select 1 from public.medication_schedules ms
        where ms.medication_id = selected_medication_id and ms.pet_id = p_pet_id
      ) and not current_actor_is_owner then
        raise exception 'Only the pet owner can remove medication schedules.' using errcode = '42501';
      end if;
      delete from public.medication_schedules where medication_id = selected_medication_id and pet_id = p_pet_id;
    else
      if exists (
        select 1 from public.medication_schedules ms
        where ms.medication_id = selected_medication_id
          and ms.pet_id = p_pet_id
          and not (ms.id = any(kept_schedule_ids))
      ) and not current_actor_is_owner then
        raise exception 'Only the pet owner can remove medication schedules.' using errcode = '42501';
      end if;
      delete from public.medication_schedules
      where medication_id = selected_medication_id and pet_id = p_pet_id and not (id = any(kept_schedule_ids));
    end if;
  elsif selected_medication_id is not null then
    if exists (
      select 1 from public.medication_schedules ms
      where ms.medication_id = selected_medication_id and ms.pet_id = p_pet_id
    ) and not current_actor_is_owner then
      raise exception 'Only the pet owner can remove medication schedules.' using errcode = '42501';
    end if;
    delete from public.medication_schedules where medication_id = selected_medication_id and pet_id = p_pet_id;
    selected_medication_id := null;
  end if;

  response_result := app_private.care_setup_snapshot(p_pet_id, selected_condition_id, selected_plan_id);
  insert into app_private.care_setup_mutations (actor_user_id, client_mutation_id, pet_id, result)
  values (current_actor_user_id, mutation_id, p_pet_id, response_result);
  return response_result;
end;
$$;

create or replace function public.save_care_setup_v1(
  p_pet_id uuid,
  p_request jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app_private.save_care_setup_v1(p_pet_id, p_request);
$$;

revoke insert, update, delete on table public.conditions from authenticated;
revoke insert, update, delete on table public.care_plans from authenticated;
revoke insert, update, delete on table public.medications from authenticated;
revoke insert, update, delete on table public.medication_schedules from authenticated;

revoke execute on function app_private.care_setup_snapshot(uuid, uuid, uuid) from public, anon;
revoke execute on function app_private.save_care_setup_v1(uuid, jsonb) from public, anon;
grant usage on schema app_private to authenticated;
grant execute on function app_private.save_care_setup_v1(uuid, jsonb) to authenticated;

revoke execute on function public.save_care_setup_v1(uuid, jsonb) from public, anon;
grant execute on function public.save_care_setup_v1(uuid, jsonb) to authenticated;
