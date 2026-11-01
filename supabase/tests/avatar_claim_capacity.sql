begin;
create temporary table avatar_capacity as select gen_random_uuid() owner_id,gen_random_uuid() pet_id,null::uuid large_job,null::uuid exact_job;
insert into auth.users(id,email) select owner_id,owner_id::text||'@avatar-capacity.test' from avatar_capacity;
insert into public.pets(id,owner_id,name,species) select pet_id,owner_id,'Capacity','cat' from avatar_capacity;
select set_config('request.jwt.claim.sub',owner_id::text,true) from avatar_capacity;
do $$ declare f record;r jsonb;begin
 select * into f from avatar_capacity;
 r:=public.prepare_pet_avatar_job(f.pet_id,gen_random_uuid(),gen_random_uuid(),'image/png',5242881,'avatar-ai-2026-11-01','privacy-2026-11-01');
 update avatar_capacity set large_job=(r->>'job_id')::uuid;
 r:=public.prepare_pet_avatar_job(f.pet_id,gen_random_uuid(),gen_random_uuid(),'image/png',5242880,'avatar-ai-2026-11-01','privacy-2026-11-01');
 update avatar_capacity set exact_job=(r->>'job_id')::uuid;
end; $$;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
do $$ declare f record;r jsonb;begin
 select * into f from avatar_capacity;
 r:=public.claim_pet_avatar_job_v1(f.large_job,f.owner_id);
 if r->>'error'<>'avatar_image_too_large' or r->>'status'<>'failed' then raise exception 'oversize not failed early';end if;
 if exists(select 1 from app_private.avatar_mutation_receipts where job_id=f.large_job and started_at is not null) then raise exception 'oversize consumed quota';end if;
 if not exists(select 1 from app_private.resource_cleanup_jobs q join public.pet_avatar_jobs j on q.storage_path=j.source_path where j.id=f.large_job) then raise exception 'oversize source not queued';end if;
 r:=public.claim_pet_avatar_job_v1(f.exact_job,f.owner_id);
 if r->>'status'<>'processing' then raise exception 'exact5MiB rejected';end if;
 r:=public.claim_pet_avatar_job_v1(f.large_job,f.owner_id);
 if r->>'error'<>'avatar_job_closed' then raise exception 'closed oversize reopened';end if;
 update public.pet_avatar_jobs set source_byte_size=5242881 where id=f.exact_job;
 r:=public.claim_pet_avatar_job_v1(f.exact_job,f.owner_id);
 if r->>'error'<>'avatar_in_progress' then raise exception 'capacity preempted processing status';end if;
 update public.pet_avatar_jobs set status='ready' where id=f.exact_job;
 r:=public.claim_pet_avatar_job_v1(f.exact_job,f.owner_id);
 if r->>'status'<>'ready' then raise exception 'capacity preempted ready status';end if;
end; $$;
-- Oversize keeps its error priority even when all ten admission slots are already consumed.
select set_config('request.jwt.claim.sub',owner_id::text,true) from avatar_capacity;
do $$ declare f record;r jsonb;large uuid;i integer;begin
 select * into f from avatar_capacity;
 for i in 1..9 loop
 r:=public.prepare_pet_avatar_job(f.pet_id,gen_random_uuid(),gen_random_uuid(),'image/png',24,'avatar-ai-2026-11-01','privacy-2026-11-01');
 perform public.claim_pet_avatar_job_v1((r->>'job_id')::uuid,f.owner_id);
 end loop;
 r:=public.prepare_pet_avatar_job(f.pet_id,gen_random_uuid(),gen_random_uuid(),'image/png',5242881,'avatar-ai-2026-11-01','privacy-2026-11-01');
 large:=(r->>'job_id')::uuid;
 r:=public.claim_pet_avatar_job_v1(large,f.owner_id);
 if r->>'error'<>'avatar_image_too_large' then raise exception 'quota preempted oversize validation';end if;
 if (select count(*) from app_private.avatar_mutation_receipts where requester_key=app_private.requester_key(f.owner_id) and started_at is not null)<>10
 or exists(select 1 from app_private.avatar_mutation_receipts where job_id=large and started_at is not null) then raise exception 'oversize changed full quota';end if;
end; $$;
rollback;
select 'queued5MiB capacity precedes quota, exact boundary and terminal status precedence passed' result;
