-- Reuse the existing minute cleanup cron. Frozen batches and sorted pet locks match the drain budget.
create or replace function app_private.expire_all_avatar_source_jobs()
returns integer language plpgsql security definer set search_path='' as $$
declare candidates uuid[]; pets uuid[]; target uuid; job public.pet_avatar_jobs; started timestamptz;
 source_cutoff timestamptz:=statement_timestamp()-interval '1 hour';
 processing_cutoff timestamptz:=statement_timestamp()-interval '10 minutes';
 expired integer:=0;
begin
 perform app_private.lock_pet_resource_writes();
 select array_agg(id order by created_at,id) into candidates from (
  select j.id,j.created_at from public.pet_avatar_jobs j join public.pets p on p.id=j.pet_id
  left join app_private.avatar_mutation_receipts r on r.job_id=j.id
  where j.created_at<source_cutoff and (j.status='queued'
   or (j.status='processing' and coalesce(r.started_at,j.updated_at)<processing_cutoff))
  and not exists(select 1 from app_private.account_deletion_jobs d where d.user_id=j.requester_id or d.user_id=p.owner_id)
  order by j.created_at,j.id limit 100
 ) due;
 -- Do not expand this frozen candidate set after waiting for locks.
 select array_agg(distinct pet_id order by pet_id) into pets from public.pet_avatar_jobs where id=any(candidates);
 perform app_private.lock_memory_pets(pets);
 for target in select id from public.pet_avatar_jobs where id=any(candidates) order by pet_id,id loop
  select * into job from public.pet_avatar_jobs where id=target for update;
  if not found then continue; end if;
  if exists(select 1 from app_private.account_deletion_jobs d where d.user_id=job.requester_id
   or exists(select 1 from public.pets p where p.id=job.pet_id and p.owner_id=d.user_id)) then continue; end if;
  select r.started_at into started from app_private.avatar_mutation_receipts r where r.job_id=job.id;
  if job.created_at<source_cutoff and (job.status='queued'
   or (job.status='processing' and coalesce(started,job.updated_at)<processing_cutoff)) then
   update public.pet_avatar_jobs set status='failed',error_code='avatar_provider_failed',provider_error=null,
    completed_at=clock_timestamp(),updated_at=clock_timestamp() where id=job.id;
   insert into app_private.resource_cleanup_jobs(bucket_id,storage_path) values('pet-avatars',job.source_path) on conflict do nothing;
   expired:=expired+1;
  end if;
 end loop;
 return expired;
end; $$;
revoke all on function app_private.expire_all_avatar_source_jobs() from public,anon,authenticated;

create or replace function app_private.request_account_deletion_cleanup_v1()
returns void language plpgsql security definer set search_path = ''
as $$
declare
  functions_url text;
  worker_secret text;
begin
  -- Database expiry must still run when the existing HTTP worker secrets are absent.
  perform app_private.expire_all_avatar_source_jobs();
  delete from app_private.account_deletion_leases where expires_at < now();
  select decrypted_secret into functions_url from vault.decrypted_secrets
  where name = 'pawbloom_functions_url';
  select decrypted_secret into worker_secret from vault.decrypted_secrets
  where name = 'pawbloom_account_deletion_worker_secret';
  if functions_url is null or worker_secret is null then return; end if;
  perform net.http_post(
    url := rtrim(functions_url, '/') || '/functions/v1/delete-account',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-pawbloom-account-deletion-worker', worker_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
end;
$$;

create or replace function app_private.prepare_pet_avatar_job(p_pet_id uuid,p_client_mutation_id uuid,p_source_asset_id uuid,p_source_content_type text,p_source_byte_size bigint,p_consent_version text,p_policy_version text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); key bytea; hash bytea; receipt app_private.avatar_mutation_receipts; job public.pet_avatar_jobs; limits app_private.memory_limits;
begin
 perform app_private.lock_pet_resource_writes();
 if actor is null then raise exception 'avatar_owner_required' using errcode='42501'; end if;
 -- Reject non-owners before expiry/account-deletion details, then recheck after the pet locks.
 if not app_private.all_pet_owner(array[p_pet_id],actor) then raise exception 'avatar_owner_required' using errcode='42501'; end if;
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
 if job.source_byte_size>5242880 then failure:='avatar_image_too_large';
 elsif job.consent_version<>'avatar-ai-2026-10-31' or job.policy_version<>'privacy-2026-10-31' then failure:='avatar_invalid_input';
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

