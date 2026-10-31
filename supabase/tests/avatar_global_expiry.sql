begin;
create temporary table global_expiry_fixture as select gen_random_uuid() owner_id,gen_random_uuid() other_id,gen_random_uuid() pet_id,gen_random_uuid() other_pet;
create temporary table global_expiry_cases(label text primary key,job_id uuid not null);
grant all on global_expiry_fixture,global_expiry_cases to authenticated,service_role;
insert into auth.users(id,email) select id,id::text||'@global-expiry.test' from global_expiry_fixture,lateral unnest(array[owner_id,other_id]) u(id);
insert into public.pets(id,owner_id,name,species) select pet_id,owner_id,'Global expiry A','cat' from global_expiry_fixture union all select other_pet,other_id,'Global expiry B','dog' from global_expiry_fixture;
select set_config('request.jwt.claim.sub',owner_id::text,true) from global_expiry_fixture;
do $$ declare f record;label text;r jsonb;begin
 select * into f from global_expiry_fixture;
 foreach label in array array['queued_old','source_exact','source_59m','processing_old','processing_exact','processing_9m','late_claim','processing_fallback','ready','failed','cancelled','orphan'] loop
 r:=public.prepare_pet_avatar_job(f.pet_id,gen_random_uuid(),gen_random_uuid(),'image/png',24,'avatar-ai-2026-10-31','privacy-2026-10-31');
 insert into global_expiry_cases values(label,(r->>'job_id')::uuid);
 end loop;
 perform set_config('request.jwt.claim.sub',f.other_id::text,true);
 r:=public.prepare_pet_avatar_job(f.other_pet,gen_random_uuid(),gen_random_uuid(),'image/png',24,'avatar-ai-2026-10-31','privacy-2026-10-31');
 insert into global_expiry_cases values('other_requester',(r->>'job_id')::uuid);
end; $$;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
do $$ declare f record;count_before integer;count_after integer;r jsonb;begin
 select * into f from global_expiry_fixture;
 if auth.uid() is not null then raise exception 'cron retained user sub';end if;
 update public.pet_avatar_jobs set created_at=statement_timestamp()-interval '2 hours',updated_at=statement_timestamp()-interval '11 minutes' where id in(select job_id from global_expiry_cases);
 update public.pet_avatar_jobs set created_at=statement_timestamp()-interval '1 hour' where id=(select job_id from global_expiry_cases where label='source_exact');
 update public.pet_avatar_jobs set created_at=statement_timestamp()-interval '59 minutes' where id=(select job_id from global_expiry_cases where label='source_59m');
 update public.pet_avatar_jobs j set status='processing' from global_expiry_cases c where j.id=c.job_id and c.label in('processing_old','processing_exact','processing_9m','late_claim','processing_fallback');
 update app_private.avatar_mutation_receipts r set started_at=case c.label
 when 'processing_old' then statement_timestamp()-interval '11 minutes'
 when 'processing_exact' then statement_timestamp()-interval '10 minutes'
 when 'processing_9m' then statement_timestamp()-interval '9 minutes'
 when 'late_claim' then statement_timestamp()-interval '1 minute' end
 from global_expiry_cases c where c.job_id=r.job_id and c.label in('processing_old','processing_exact','processing_9m','late_claim');
 update public.pet_avatar_jobs set status='ready' where id=(select job_id from global_expiry_cases where label='ready');
 update public.pet_avatar_jobs set status='failed' where id=(select job_id from global_expiry_cases where label='failed');
 update public.pet_avatar_jobs set status='cancelled' where id=(select job_id from global_expiry_cases where label='cancelled');
 update public.pet_avatar_jobs set requester_id=null where id=(select job_id from global_expiry_cases where label='orphan');
 select count(*) into count_before from app_private.avatar_mutation_receipts where job_id in(select job_id from global_expiry_cases) and started_at is not null;
 -- Exercise the real cron entry with no user sub, even when no HTTP worker secrets exist.
 perform app_private.request_account_deletion_cleanup_v1();
 if exists(select 1 from global_expiry_cases c join public.pet_avatar_jobs j on j.id=c.job_id where c.label in('queued_old','processing_old','processing_fallback','other_requester','orphan')
 and (j.status<>'failed' or j.error_code<>'avatar_provider_failed' or j.completed_at is null)) then raise exception 'global cron skipped expired requester/orphan';end if;
 if exists(select 1 from global_expiry_cases c join public.pet_avatar_jobs j on j.id=c.job_id where c.label in('source_exact','source_59m') and j.status<>'queued') then raise exception 'global source boundary violated';end if;
 if exists(select 1 from global_expiry_cases c join public.pet_avatar_jobs j on j.id=c.job_id where c.label in('processing_exact','processing_9m','late_claim') and j.status<>'processing') then raise exception 'processing grace violated';end if;
 if (select count(*) from app_private.resource_cleanup_jobs q join public.pet_avatar_jobs j on q.storage_path=j.source_path join global_expiry_cases c on c.job_id=j.id where c.label in('queued_old','processing_old','processing_fallback','other_requester','orphan'))<>5 then raise exception 'global durable cleanup missing';end if;
 if not exists(select 1 from global_expiry_cases c join public.pet_avatar_jobs j on j.id=c.job_id where c.label='ready' and j.status='ready')
 or not exists(select 1 from global_expiry_cases c join public.pet_avatar_jobs j on j.id=c.job_id where c.label='failed' and j.status='failed' and j.error_code is null)
 or not exists(select 1 from global_expiry_cases c join public.pet_avatar_jobs j on j.id=c.job_id where c.label='cancelled' and j.status='cancelled') then raise exception 'global changed terminal job';end if;
 select count(*) into count_after from app_private.avatar_mutation_receipts where job_id in(select job_id from global_expiry_cases) and started_at is not null;
 if count_after<>count_before or count_before<>4 then raise exception 'global changed quota receipts';end if;
 if has_function_privilege('anon','app_private.expire_all_avatar_source_jobs()','EXECUTE') or has_function_privilege('authenticated','app_private.expire_all_avatar_source_jobs()','EXECUTE') then raise exception 'global helper exposed';end if;
end; $$;
-- Simulate a claim at source minute59: still running at minute68, eligible just after minute69.
do $$ declare target_job uuid;begin
 select job_id into target_job from global_expiry_cases where label='late_claim';
 update public.pet_avatar_jobs set created_at=statement_timestamp()-interval '68 minutes' where pet_avatar_jobs.id=target_job;
 update app_private.avatar_mutation_receipts set started_at=statement_timestamp()-interval '9 minutes' where job_id=target_job;
 perform app_private.expire_all_avatar_source_jobs();
 if (select status from public.pet_avatar_jobs where pet_avatar_jobs.id=target_job)<>'processing' then raise exception 'late claim killed before grace';end if;
 update public.pet_avatar_jobs set created_at=statement_timestamp()-interval '69 minutes 1 second' where pet_avatar_jobs.id=target_job;
 update app_private.avatar_mutation_receipts set started_at=statement_timestamp()-interval '10 minutes 1 second' where job_id=target_job;
 perform app_private.expire_all_avatar_source_jobs();
 if (select status from public.pet_avatar_jobs where pet_avatar_jobs.id=target_job)<>'failed' then raise exception 'late claim exceeded strengthened threshold';end if;
end; $$;
-- More than one batch, with older deletion-in-progress jobs excluded before LIMIT.
do $$ declare f record;n integer;gid uuid;begin
 select * into f from global_expiry_fixture;
 for n in 1..105 loop
 gid:=gen_random_uuid();
 insert into public.pet_avatar_jobs(id,pet_id,requester_id,client_mutation_id,source_path,source_content_type,source_byte_size,consent_version,policy_version,created_at)
 values(gid,f.other_pet,f.other_id,gen_random_uuid(),f.other_pet::text||'/'||gid::text||'/'||gen_random_uuid(),'image/png',24,'v1','v1',statement_timestamp()-interval '4 hours');
 insert into global_expiry_cases values('batch_'||n,gid);
 end loop;
 for n in 1..101 loop
 gid:=gen_random_uuid();
 insert into public.pet_avatar_jobs(id,pet_id,requester_id,client_mutation_id,source_path,source_content_type,source_byte_size,consent_version,policy_version,created_at)
 values(gid,f.pet_id,f.owner_id,gen_random_uuid(),f.pet_id::text||'/'||gid::text||'/'||gen_random_uuid(),'image/png',24,'v1','v1',statement_timestamp()-interval '8 hours');
 insert into global_expiry_cases values('deleting_'||n,gid);
 end loop;
 insert into app_private.account_deletion_jobs(user_id) values(f.owner_id);
 n:=app_private.expire_all_avatar_source_jobs();
 if n<>100 or (select count(*) from global_expiry_cases c join public.pet_avatar_jobs j on j.id=c.job_id where c.label like 'batch_%' and j.status='failed')<>100 then raise exception 'bounded batch/skip-before-limit failed';end if;
 if exists(select 1 from global_expiry_cases c join public.pet_avatar_jobs j on j.id=c.job_id where c.label like 'deleting_%' and j.status<>'queued') then raise exception 'global changed deleting account';end if;
 perform app_private.expire_all_avatar_source_jobs();
 if exists(select 1 from global_expiry_cases c join public.pet_avatar_jobs j on j.id=c.job_id where c.label like 'batch_%' and j.status<>'failed') then raise exception 'second batch did not finish';end if;
end; $$;
-- Non-owner receives only owner_required, even if the target account is deleting.
set local role authenticated;
select set_config('request.jwt.claim.sub',other_id::text,true) from global_expiry_fixture;
do $$ declare f record;begin
 select * into f from global_expiry_fixture;
 begin perform public.prepare_pet_avatar_job(f.pet_id,gen_random_uuid(),gen_random_uuid(),'image/png',24,'v1','v1');raise exception 'non-owner prepare accepted';
 exception when insufficient_privilege then if sqlerrm<>'avatar_owner_required' then raise;end if;end;
end; $$;
reset role;
rollback;
select 'global no-sub cron/requester/orphan/bounds/grace/receipt/deletion/privacy priority assertions passed' result;
