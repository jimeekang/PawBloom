-- Lazy one-hour expiry: only a subsequent request from the same requester triggers it.
-- No new scheduler or worker is added; deletion stays in the existing durable cleanup queue.
create or replace function app_private.expire_avatar_source_jobs(p_requester_id uuid,p_target_pet_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare pets uuid[]; target uuid; job public.pet_avatar_jobs; started timestamptz;
 cutoff timestamptz:=statement_timestamp()-interval '1 hour';
begin
 perform app_private.lock_pet_resource_writes();
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('avatar-generation:'||p_requester_id::text,0));
 -- Lock the complete pet set once, never target first followed by an older pet.
 select array_agg(distinct pet_id order by pet_id) into pets from (
  select p_target_pet_id as pet_id
  union all
  select j.pet_id from public.pet_avatar_jobs j
  left join app_private.avatar_mutation_receipts r on r.job_id=j.id
  join public.pets p on p.id=j.pet_id
  where j.requester_id=p_requester_id and (
   (j.status='queued' and j.created_at<cutoff)
   or (j.status='processing' and coalesce(r.started_at,j.updated_at)<cutoff))
  and not exists(select 1 from app_private.account_deletion_jobs d where d.user_id=p_requester_id or d.user_id=p.owner_id)
 ) candidates;
 perform app_private.lock_memory_pets(pets);
 perform app_private.assert_avatar_generation_account(array[p_target_pet_id],p_requester_id);
 for target in select j.id from public.pet_avatar_jobs j where j.requester_id=p_requester_id and j.pet_id=any(pets)
 and j.status in ('queued','processing') order by j.pet_id,j.id loop
  select * into job from public.pet_avatar_jobs where id=target and requester_id=p_requester_id for update;
  if not found then continue; end if;
  if exists(select 1 from app_private.account_deletion_jobs d where d.user_id=p_requester_id
   or exists(select 1 from public.pets p where p.id=job.pet_id and p.owner_id=d.user_id)) then continue; end if;
  select r.started_at into started from app_private.avatar_mutation_receipts r where r.job_id=job.id;
  if (job.status='queued' and job.created_at<cutoff)
   or (job.status='processing' and coalesce(started,job.updated_at)<cutoff) then
   update public.pet_avatar_jobs set status='failed',error_code='avatar_provider_failed',provider_error=null,
    completed_at=clock_timestamp(),updated_at=clock_timestamp() where id=job.id;
   insert into app_private.resource_cleanup_jobs(bucket_id,storage_path) values('pet-avatars',job.source_path) on conflict do nothing;
  end if;
 end loop;
end; $$;
revoke all on function app_private.expire_avatar_source_jobs(uuid,uuid) from public,anon,authenticated;

create or replace function app_private.prepare_pet_avatar_job(p_pet_id uuid,p_client_mutation_id uuid,p_source_asset_id uuid,p_source_content_type text,p_source_byte_size bigint,p_consent_version text,p_policy_version text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); key bytea; hash bytea; receipt app_private.avatar_mutation_receipts; job public.pet_avatar_jobs; limits app_private.memory_limits;
begin
 perform app_private.lock_pet_resource_writes();
 if actor is null then raise exception 'avatar_owner_required' using errcode='42501'; end if;
 key:=app_private.requester_key(actor);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('avatar-generation:'||actor::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('avatar-mutation:'||encode(key,'hex')||':'||p_client_mutation_id::text,0));
 perform app_private.expire_avatar_source_jobs(actor,p_pet_id);
 perform app_private.assert_memory_account(array[p_pet_id]);
 if not app_private.all_pet_owner(array[p_pet_id],actor) then raise exception 'avatar_owner_required' using errcode='42501'; end if;
 select * into limits from app_private.memory_limits;
 if p_client_mutation_id is null or p_source_asset_id is null or p_source_content_type is null or not(p_source_content_type=any(limits.mime_types))
 or p_source_byte_size is null or p_source_byte_size<=0 or p_source_byte_size>limits.max_file_bytes
 or nullif(btrim(p_consent_version),'') is null or nullif(btrim(p_policy_version),'') is null then raise exception 'avatar_invalid_input' using errcode='22023'; end if;
 hash:=extensions.digest(jsonb_build_array(p_pet_id,p_source_asset_id,p_source_content_type,p_source_byte_size,p_consent_version,p_policy_version)::text,'sha256');
 select * into receipt from app_private.avatar_mutation_receipts where requester_key=key and client_mutation_id=p_client_mutation_id;
 if found then
 if receipt.deleted then raise exception 'avatar_deleted' using errcode='55000'; end if;
 if receipt.payload_hash<>hash then raise exception 'avatar_mutation_conflict' using errcode='23505'; end if;
 select * into job from public.pet_avatar_jobs where id=receipt.job_id;
 else
 job.id:=gen_random_uuid();
 insert into public.pet_avatar_jobs(id,pet_id,requester_id,client_mutation_id,source_path,source_content_type,source_byte_size,consent_version,policy_version)
 values(job.id,p_pet_id,actor,p_client_mutation_id,p_pet_id::text||'/'||job.id::text||'/'||p_source_asset_id::text,p_source_content_type,p_source_byte_size,p_consent_version,p_policy_version)
 returning * into job;
 insert into app_private.avatar_mutation_receipts values(key,p_client_mutation_id,job.id,hash,false);
 end if;
 return jsonb_build_object('job_id',job.id,'pet_id',job.pet_id,'status',job.status,'bucket_id','pet-avatars','source_path',job.source_path,'source_content_type',job.source_content_type,'source_byte_size',job.source_byte_size);
end; $$;

create or replace function public.claim_pet_avatar_job_v1(p_job_id uuid,p_requester_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.pet_avatar_jobs; failure text;
begin
 perform app_private.lock_pet_resource_writes();
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('avatar-generation:'||p_requester_id::text,0));
 select * into job from public.pet_avatar_jobs where id=p_job_id and requester_id=p_requester_id;
 if not found then return jsonb_build_object('error','avatar_not_found'); end if;
 perform app_private.expire_avatar_source_jobs(p_requester_id,job.pet_id);
 perform app_private.assert_avatar_generation_account(array[job.pet_id],p_requester_id);
 select * into job from public.pet_avatar_jobs where id=p_job_id and requester_id=p_requester_id for update;
 if not found then return jsonb_build_object('error','avatar_not_found'); end if;
 if not app_private.all_pet_owner(array[job.pet_id],p_requester_id) then return jsonb_build_object('error','avatar_owner_required'); end if;
 if job.status='ready' then return to_jsonb(job); end if;
 if job.status='processing' then return jsonb_build_object('error','avatar_in_progress'); end if;
 if job.status<>'queued' then return jsonb_build_object('error','avatar_job_closed'); end if;
 if job.consent_version<>'avatar-ai-2026-10-31' or job.policy_version<>'privacy-2026-10-31' then failure:='avatar_invalid_input';
 elsif (select count(*) from app_private.avatar_mutation_receipts where requester_key=app_private.requester_key(p_requester_id) and started_at>=statement_timestamp()-interval '24 hours')>=10 then failure:='avatar_daily_limit';
 end if;
 if failure is not null then
 update public.pet_avatar_jobs set status='failed',error_code=failure,completed_at=clock_timestamp(),updated_at=clock_timestamp() where id=job.id returning * into job;
 insert into app_private.resource_cleanup_jobs(bucket_id,storage_path) values('pet-avatars',job.source_path) on conflict do nothing;
 return to_jsonb(job)||jsonb_build_object('error',failure);
 end if;
 update app_private.avatar_mutation_receipts set started_at=clock_timestamp() where job_id=job.id;
 if not found then raise exception 'avatar_invalid_input' using errcode='22023'; end if;
 update public.pet_avatar_jobs set status='processing',updated_at=clock_timestamp() where id=job.id returning * into job;
 return to_jsonb(job);
end; $$;

