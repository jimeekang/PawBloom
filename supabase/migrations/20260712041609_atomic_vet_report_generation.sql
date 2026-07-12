create or replace function public.create_vet_report_draft_v1(
  p_pet_id uuid,
  p_range_days integer,
  p_english_summary text,
  p_payload jsonb,
  p_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_report_id uuid;
begin
  if not app_private.has_pet_role(
    p_pet_id,
    p_created_by,
    array['owner']::public.pet_member_role[]
  ) then
    raise exception 'Only the pet owner can create a report.' using errcode = '42501';
  end if;
  if p_range_days not in (3, 7, 14)
    or p_english_summary is null
    or position('This is a record-based summary, not a diagnosis.' in p_english_summary) = 0
    or (p_payload ->> 'version') is distinct from '1'
    or (p_payload ->> 'disclaimer') is distinct from 'This is a record-based summary, not a diagnosis. Contact a veterinarian for medical decisions.'
    or jsonb_typeof(p_payload -> 'entries') is distinct from 'array'
    or jsonb_typeof(p_payload -> 'medicationDoses') is distinct from 'array' then
    raise exception 'Invalid vet report draft payload.' using errcode = '22023';
  end if;

  insert into public.vet_reports (
    pet_id, range_days, status, english_summary, payload,
    confirmed_by_owner, created_by
  ) values (
    p_pet_id, p_range_days, 'draft', p_english_summary, p_payload,
    false, p_created_by
  ) returning id into created_report_id;

  return created_report_id;
end;
$$;

revoke execute on function public.create_vet_report_draft_v1(uuid, integer, text, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.create_vet_report_draft_v1(uuid, integer, text, jsonb, uuid)
  to service_role;
