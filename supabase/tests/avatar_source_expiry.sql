begin;
create temporary table expiry_fixture as select gen_random_uuid() owner_id,gen_random_uuid() other_id,
 gen_random_uuid() pet_id,gen_random_uuid() old_pet;
create temporary table expiry_cases(label text primary key,job_id uuid not null);
insert into auth.users(id,email) select id,id::text||'@avatar-expiry.test' from expiry_fixture,lateral unnest(array[owner_id,other_id]) u(id);
update public.subscription_entitlements set plan='family' where user_id=(select owner_id from expiry_fixture);
insert into public.pets(id,owner_id,name,species) select p,owner_id,'Expiry','cat' from expiry_fixture,lateral unnest(array[pet_id,old_pet]) x(p);
select set_config('request.jwt.claim.sub',owner_id::text,true) from expiry_fixture;
do $$ declare f record;label text;r jsonb;begin
 select * into f from expiry_fixture;
 foreach label in array array['queued_old','queued_59m','queued_exact','processing_old','processing_59m','processing_exact','created_old_started_fresh','processing_no_start','ready_old','failed_old','cancelled_old'] loop
 r:=public.prepare_pet_avatar_job(f.old_pet,gen_random_uuid(),gen_random_uuid(),'image/png',24,'avatar-ai-2026-11-01','privacy-2026-11-01');
 insert into expiry_cases values(label,(r->>'job_id')::uuid);
 end loop;
end; $$;
-- Other-requester rows must never be swept, even when an owned pet is in the lock set.
insert into public.pet_avatar_jobs(id,pet_id,requester_id,client_mutation_id,source_path,source_content_type,source_byte_size,consent_version,policy_version)
select j.id,f.old_pet,f.other_id,gen_random_uuid(),f.old_pet::text||'/'||j.id::text||'/'||gen_random_uuid(),'image/png',24,'avatar-ai-2026-11-01','privacy-2026-11-01' from expiry_fixture f,lateral(select gen_random_uuid() id) j;
insert into expiry_cases select 'other_requester',id from public.pet_avatar_jobs where requester_id=(select other_id from expiry_fixture);
do $$ declare f record;r jsonb;before_count integer;after_count integer;begin
 select * into f from expiry_fixture;
 -- All timestamp writes and the triggering call share statement_timestamp(), including the exact boundary.
 update public.pet_avatar_jobs j set created_at=statement_timestamp()-interval '2 hours',updated_at=statement_timestamp()-interval '2 hours'
 where j.id in(select job_id from expiry_cases);
 update public.pet_avatar_jobs set created_at=statement_timestamp()-interval '59 minutes' where id=(select job_id from expiry_cases where label='queued_59m');
 update public.pet_avatar_jobs set created_at=statement_timestamp()-interval '1 hour' where id=(select job_id from expiry_cases where label='queued_exact');
 update public.pet_avatar_jobs j set status='processing' from expiry_cases c where c.job_id=j.id and c.label in('processing_old','processing_59m','processing_exact','created_old_started_fresh','processing_no_start');
 update app_private.avatar_mutation_receipts r set started_at=case c.label
 when 'processing_old' then statement_timestamp()-interval '2 hours'
 when 'processing_59m' then statement_timestamp()-interval '59 minutes'
 when 'processing_exact' then statement_timestamp()-interval '1 hour'
 when 'created_old_started_fresh' then statement_timestamp()-interval '5 minutes' end
 from expiry_cases c where c.job_id=r.job_id and c.label in('processing_old','processing_59m','processing_exact','created_old_started_fresh');
 update public.pet_avatar_jobs set status='ready' where id=(select job_id from expiry_cases where label='ready_old');
 update public.pet_avatar_jobs set status='failed' where id=(select job_id from expiry_cases where label='failed_old');
 update public.pet_avatar_jobs set status='cancelled' where id=(select job_id from expiry_cases where label='cancelled_old');
 select count(*) into before_count from app_private.avatar_mutation_receipts where started_at is not null and requester_key=app_private.requester_key(f.owner_id);
 perform public.prepare_pet_avatar_job(f.pet_id,gen_random_uuid(),gen_random_uuid(),'image/png',24,'avatar-ai-2026-11-01','privacy-2026-11-01');
 if exists(select 1 from expiry_cases c join public.pet_avatar_jobs j on j.id=c.job_id where c.label in('queued_old','processing_old','processing_no_start')
 and (j.status<>'failed' or j.error_code<>'avatar_provider_failed' or j.completed_at is null)) then raise exception 'old source did not expire';end if;
 if (select count(*) from app_private.resource_cleanup_jobs q join public.pet_avatar_jobs j on q.storage_path=j.source_path join expiry_cases c on c.job_id=j.id where c.label in('queued_old','processing_old','processing_no_start'))<>3 then raise exception 'expiry cleanup not atomic';end if;
 if exists(select 1 from expiry_cases c join public.pet_avatar_jobs j on j.id=c.job_id where c.label in('queued_59m','queued_exact','other_requester') and j.status<>'queued') then raise exception 'fresh/boundary/other queued row expired';end if;
 if exists(select 1 from expiry_cases c join public.pet_avatar_jobs j on j.id=c.job_id where c.label in('processing_59m','processing_exact','created_old_started_fresh') and j.status<>'processing') then raise exception 'fresh/boundary processing row expired';end if;
 if not exists(select 1 from public.pet_avatar_jobs j join expiry_cases c on c.job_id=j.id where c.label='ready_old' and j.status='ready')
 or not exists(select 1 from public.pet_avatar_jobs j join expiry_cases c on c.job_id=j.id where c.label='failed_old' and j.status='failed' and j.error_code is null)
 or not exists(select 1 from public.pet_avatar_jobs j join expiry_cases c on c.job_id=j.id where c.label='cancelled_old' and j.status='cancelled') then raise exception 'terminal row changed';end if;
 select count(*) into after_count from app_private.avatar_mutation_receipts where started_at is not null and requester_key=app_private.requester_key(f.owner_id);
 if before_count<>4 or after_count<>before_count then raise exception 'expiry changed admitted quota or consumed queued quota';end if;
 if exists(select 1 from app_private.avatar_mutation_receipts r join expiry_cases c on c.job_id=r.job_id where c.label='queued_old' and r.started_at is not null) then raise exception 'queued expiry consumed quota';end if;
 if not exists(select 1 from app_private.avatar_mutation_receipts r join expiry_cases c on c.job_id=r.job_id where c.label='processing_old' and r.started_at=statement_timestamp()-interval '2 hours') then raise exception 'processing expiry rewrote admission';end if;
 -- Repeat within the same statement: exact-boundary rows still must not expire.
 perform public.prepare_pet_avatar_job(f.pet_id,gen_random_uuid(),gen_random_uuid(),'image/png',24,'avatar-ai-2026-11-01','privacy-2026-11-01');
 if (select count(*) from app_private.resource_cleanup_jobs q join public.pet_avatar_jobs j on q.storage_path=j.source_path join expiry_cases c on c.job_id=j.id where c.label in('queued_old','processing_old','processing_no_start'))<>3 then raise exception 'duplicate expiry cleanup';end if;
end; $$;
-- Retrying the original mutation returns the same now-expired job, with hash conflicts still rejected.
do $$ declare j public.pet_avatar_jobs;r jsonb;begin
 select * into j from public.pet_avatar_jobs where id=(select job_id from expiry_cases where label='queued_old');
 r:=public.prepare_pet_avatar_job(j.pet_id,j.client_mutation_id,split_part(j.source_path,'/',3)::uuid,j.source_content_type,j.source_byte_size,j.consent_version,j.policy_version);
 if r->>'job_id'<>j.id::text or r->>'status'<>'failed' then raise exception 'expiry broke prepare idempotency';end if;
 begin perform public.prepare_pet_avatar_job(j.pet_id,j.client_mutation_id,split_part(j.source_path,'/',3)::uuid,j.source_content_type,j.source_byte_size+1,j.consent_version,j.policy_version);
 raise exception 'expiry weakened mutation hash';exception when unique_violation then if sqlerrm<>'avatar_mutation_conflict' then raise;end if;end;
end; $$;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
do $$ declare f record;r jsonb;begin
 select * into f from expiry_fixture;
 if auth.uid() is not null then raise exception 'service test retained subject';end if;
 r:=public.claim_pet_avatar_job_v1((select job_id from expiry_cases where label='ready_old'),f.owner_id);
 if r->>'status'<>'ready' then raise exception 'ready duplicate did not survive';end if;
 r:=public.claim_pet_avatar_job_v1((select job_id from expiry_cases where label='queued_old'),f.owner_id);
 if r->>'error'<>'avatar_job_closed' then raise exception 'expired claim reopened';end if;
 r:=public.finish_pet_avatar_job_v1((select job_id from expiry_cases where label='processing_old'),f.owner_id,
 '{"species":"cat","confidence":0.9,"appearance":{}}',null,null);
 if r->>'error'<>'avatar_job_closed' then raise exception 'late completion reopened expired job';end if;
 if exists(select 1 from public.pet_avatars where job_id=(select job_id from expiry_cases where label='processing_old')) then raise exception 'late completion created avatar';end if;
 if has_function_privilege('authenticated','app_private.expire_avatar_source_jobs(uuid,uuid)','EXECUTE')
 or has_function_privilege('anon','app_private.expire_avatar_source_jobs(uuid,uuid)','EXECUTE') then raise exception 'expiry helper exposed';end if;
end; $$;
-- Deletion-in-progress keeps responsibility in the existing deletion flow.
insert into app_private.account_deletion_jobs(user_id) select owner_id from expiry_fixture;
do $$ declare f record;begin
 select * into f from expiry_fixture;
 begin perform app_private.expire_avatar_source_jobs(f.owner_id,f.pet_id);raise exception 'deleting requester swept';exception when sqlstate '55000' then if sqlerrm<>'account_deletion_in_progress' then raise;end if;end;
end; $$;
rollback;
select 'one-hour strict boundary, requester-only lazy expiry, quota preservation, durable idempotent cleanup and closed-state guards passed' result;
