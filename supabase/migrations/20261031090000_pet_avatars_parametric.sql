-- Parametric avatars have no generated image asset. Existing binary assets retain their checks.
alter table public.pet_avatars alter column storage_path drop not null;
alter table public.pet_avatars alter column content_type drop not null;
alter table public.pet_avatars alter column byte_size drop not null;
-- Existing regex and positive-size CHECKs already permit NULL; preserve their definitions and OIDs.
alter table public.pet_avatars add constraint pet_avatars_asset_kind_check check((
 (manifest_version='parametric-v3' and storage_path is null and content_type is null and byte_size is null
 and jsonb_typeof(manifest->'appearance')='object' and manifest->>'species' in ('cat','dog','other'))
 or (manifest_version<>'parametric-v3' and storage_path is not null and content_type is not null and byte_size>0)
 ) is true);
alter table app_private.avatar_mutation_receipts add column started_at timestamptz;
create index avatar_mutation_receipts_admitted_idx on app_private.avatar_mutation_receipts(requester_key,started_at) where started_at is not null;

create or replace function app_private.apply_pet_avatar(p_pet_id uuid,p_avatar_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform app_private.lock_memory_pets(array[p_pet_id]);
 perform app_private.assert_memory_account(array[p_pet_id]);
 if not app_private.all_pet_owner(array[p_pet_id],auth.uid()) then raise exception 'avatar_owner_required' using errcode='42501'; end if;
 if not exists(select 1 from public.pet_avatars where id=p_avatar_id and pet_id=p_pet_id) then raise exception 'avatar_not_found' using errcode='P0002'; end if;
 if not exists(select 1 from public.pet_avatars a join public.pet_avatar_jobs j on j.id=a.job_id
 where a.id=p_avatar_id and a.pet_id=p_pet_id and a.validation_status='validated' and j.status='ready' and j.requester_id=auth.uid()
 and (a.manifest_version='parametric-v3' or exists(select 1 from storage.objects o where o.bucket_id='pet-avatars' and o.name=a.storage_path
 and o.metadata->>'mimetype'=a.content_type and (o.metadata->>'size')::bigint=a.byte_size))) then
 raise exception 'avatar_not_ready' using errcode='55000'; end if;
 update public.pet_avatars set is_applied=false where pet_id=p_pet_id and is_applied;
 update public.pet_avatars set is_applied=true where id=p_avatar_id;
 return jsonb_build_object('pet_id',p_pet_id,'avatar_id',p_avatar_id,'applied',true);
end; $$;

create or replace function app_private.queue_resource_cleanup()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='memory_media' then
 insert into app_private.resource_cleanup_jobs(bucket_id,storage_path) values('memory-media',old.storage_path) on conflict do nothing;
 elsif tg_table_name='pet_avatar_jobs' then
 insert into app_private.resource_cleanup_jobs(bucket_id,storage_path) values('pet-avatars',old.source_path) on conflict do nothing;
 update app_private.avatar_mutation_receipts set deleted=true where job_id=old.id;
 elsif tg_table_name='pet_avatars' then
 if old.storage_path is not null then
 insert into app_private.resource_cleanup_jobs(bucket_id,storage_path) values('pet-avatars',old.storage_path) on conflict do nothing;
 end if;
 elsif tg_table_name='memories' then
 insert into app_private.resource_cleanup_jobs(bucket_id,storage_path) select 'memory-media',storage_path from public.memory_media where memory_id=old.id on conflict do nothing;
 update app_private.memory_mutation_receipts set deleted=true where memory_id=old.id;
 end if;
 return old;
end; $$;

-- Service-role calls have no end-user sub; the verified requester is an explicit server argument.
create or replace function app_private.assert_avatar_generation_account(p_pet_ids uuid[],p_requester_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_requester_id is null or not exists(select 1 from auth.users where id=p_requester_id) then
 raise exception 'avatar_owner_required' using errcode='42501'; end if;
 if exists(select 1 from app_private.account_deletion_jobs j where j.user_id=p_requester_id
 or exists(select 1 from public.pets p where p.id=any(p_pet_ids) and p.owner_id=j.user_id)) then
 raise exception 'account_deletion_in_progress' using errcode='55000'; end if;
end; $$;
revoke all on function app_private.assert_avatar_generation_account(uuid[],uuid) from public,anon,authenticated;

-- Only the authenticated Edge server can admit work. One requester lock protects the rolling budget.
create or replace function public.claim_pet_avatar_job_v1(p_job_id uuid,p_requester_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.pet_avatar_jobs; failure text;
begin
 perform app_private.lock_pet_resource_writes();
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('avatar-generation:'||p_requester_id::text,0));
 select * into job from public.pet_avatar_jobs where id=p_job_id and requester_id=p_requester_id;
 if not found then return jsonb_build_object('error','avatar_not_found'); end if;
 perform app_private.lock_memory_pets(array[job.pet_id]);
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

-- Atomically publish the result and reserve deletion; raw provider text never crosses this RPC.
create or replace function public.finish_pet_avatar_job_v1(p_job_id uuid,p_requester_id uuid,p_result jsonb,p_provider_raw jsonb,p_error_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.pet_avatar_jobs; avatar public.pet_avatars; raw jsonb; completed timestamptz:=clock_timestamp();
begin
 perform app_private.lock_pet_resource_writes();
 select * into job from public.pet_avatar_jobs where id=p_job_id and requester_id=p_requester_id;
 if not found then return jsonb_build_object('error','avatar_not_found'); end if;
 perform app_private.lock_memory_pets(array[job.pet_id]);
 perform app_private.assert_avatar_generation_account(array[job.pet_id],p_requester_id);
 select * into job from public.pet_avatar_jobs where id=p_job_id and requester_id=p_requester_id for update;
 if not found then return jsonb_build_object('error','avatar_not_found'); end if;
 if not app_private.all_pet_owner(array[job.pet_id],p_requester_id) then return jsonb_build_object('error','avatar_owner_required'); end if;
 if job.status='ready' then return jsonb_build_object('status','ready'); end if;
 if job.status<>'processing' then return jsonb_build_object('error','avatar_job_closed'); end if;
 raw:=case when p_provider_raw is null then null else jsonb_build_object(
 'model','claude-sonnet-5-5','stop_reason',p_provider_raw->'stop_reason',
 'usage',jsonb_build_object('input_tokens',p_provider_raw->'usage'->'input_tokens','output_tokens',p_provider_raw->'usage'->'output_tokens'),
 'request_id',p_provider_raw->'request_id') end;
 if p_error_code is not null then
 if p_error_code not in ('avatar_invalid_input','avatar_image_invalid','avatar_image_too_large','avatar_provider_refused','avatar_provider_failed','avatar_no_pet_found','avatar_unknown') then raise exception 'avatar_invalid_input' using errcode='22023'; end if;
 update public.pet_avatar_jobs set status='failed',error_code=p_error_code,provider_error=null,provider_raw=raw,completed_at=completed,updated_at=completed where id=job.id;
 else
 if (jsonb_typeof(p_result->'appearance')='object' and p_result->>'species' in ('cat','dog')
 and (p_result->>'confidence')::numeric between 0.35 and 1) is not true then raise exception 'avatar_invalid_input' using errcode='22023'; end if;
 insert into public.pet_avatars(pet_id,job_id,style_version,manifest_version,manifest,storage_path,content_type,byte_size,validation_status)
 values(job.pet_id,job.id,'pixel-v3','parametric-v3',jsonb_build_object('appearance',p_result->'appearance','species',p_result->'species','confidence',p_result->'confidence',
 'provider',jsonb_build_object('name','anthropic','model','claude-sonnet-5-5'),'generatedAt',completed),null,null,null,'validated') returning * into avatar;
 update public.pet_avatar_jobs set status='ready',error_code=null,provider_error=null,provider_raw=raw,completed_at=completed,updated_at=completed where id=job.id;
 end if;
 insert into app_private.resource_cleanup_jobs(bucket_id,storage_path) values('pet-avatars',job.source_path) on conflict do nothing;
 return jsonb_build_object('status',case when p_error_code is null then 'ready' else 'failed' end,'avatar_id',avatar.id);
end; $$;
revoke all on function public.claim_pet_avatar_job_v1(uuid,uuid) from public,anon,authenticated;
revoke all on function public.finish_pet_avatar_job_v1(uuid,uuid,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.claim_pet_avatar_job_v1(uuid,uuid) to service_role;
grant execute on function public.finish_pet_avatar_job_v1(uuid,uuid,jsonb,jsonb,text) to service_role;

create or replace function public.queue_pet_avatar_source_cleanup_v1(p_job_id uuid,p_requester_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform app_private.lock_pet_resource_writes();
 insert into app_private.resource_cleanup_jobs(bucket_id,storage_path)
 select 'pet-avatars',source_path from public.pet_avatar_jobs where id=p_job_id and requester_id=p_requester_id on conflict do nothing;
end; $$;
revoke all on function public.queue_pet_avatar_source_cleanup_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.queue_pet_avatar_source_cleanup_v1(uuid,uuid) to service_role;
