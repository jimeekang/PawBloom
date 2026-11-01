-- Photo-to-character provider switch: Anthropic Claude -> OpenAI gpt-6.1-sol (Responses API, store:false).
-- Only literals change: consent/policy versions force re-consent, and new results record the OpenAI provider.
-- Already applied avatars keep their recorded provider; readers ignore manifest.provider.

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
 elsif job.consent_version<>'avatar-ai-2026-11-01' or job.policy_version<>'privacy-2026-11-01' then failure:='avatar_invalid_input';
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
 'model','gpt-6.1-sol','stop_reason',p_provider_raw->'stop_reason',
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
 'provider',jsonb_build_object('name','openai','model','gpt-6.1-sol'),'generatedAt',completed),null,null,null,'validated') returning * into avatar;
 update public.pet_avatar_jobs set status='ready',error_code=null,provider_error=null,provider_raw=raw,completed_at=completed,updated_at=completed where id=job.id;
 end if;
 insert into app_private.resource_cleanup_jobs(bucket_id,storage_path) values('pet-avatars',job.source_path) on conflict do nothing;
 return jsonb_build_object('status',case when p_error_code is null then 'ready' else 'failed' end,'avatar_id',avatar.id);
end; $$;
revoke all on function public.claim_pet_avatar_job_v1(uuid,uuid) from public,anon,authenticated;
revoke all on function public.finish_pet_avatar_job_v1(uuid,uuid,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.claim_pet_avatar_job_v1(uuid,uuid) to service_role;
grant execute on function public.finish_pet_avatar_job_v1(uuid,uuid,jsonb,jsonb,text) to service_role;
