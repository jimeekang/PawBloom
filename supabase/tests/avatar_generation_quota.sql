begin;
create temporary table quota_fixture as select gen_random_uuid() owner_id,gen_random_uuid() pet_id,array[]::uuid[] jobs;
grant all on quota_fixture to authenticated,service_role;
insert into auth.users(id,email) select owner_id,owner_id::text||'@quota.test' from quota_fixture;
insert into public.pets(id,owner_id,name,species) select pet_id,owner_id,'Quota','cat' from quota_fixture;
set local role authenticated;
select set_config('request.jwt.claim.sub',owner_id::text,true) from quota_fixture;
do $$ declare f record;r jsonb;i integer;begin
 select * into f from quota_fixture;
 for i in 1..11 loop
 r:=public.prepare_pet_avatar_job(f.pet_id,gen_random_uuid(),gen_random_uuid(),'image/png',24,'avatar-ai-2026-10-31','privacy-2026-10-31');
 update quota_fixture set jobs=array_append(jobs,(r->>'job_id')::uuid);
 end loop;
end; $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
do $$ begin if auth.uid() is not null then raise exception 'service test retained end-user subject';end if;end; $$;
set local role service_role;
do $$ declare f record;r jsonb;i integer;begin
 select * into f from quota_fixture;
 for i in 1..10 loop
 r:=public.claim_pet_avatar_job_v1(f.jobs[i],f.owner_id);
 if r->>'status'<>'processing' then raise exception 'valid request % denied: %',i,r;end if;
 perform public.finish_pet_avatar_job_v1(f.jobs[i],f.owner_id,null,null,'avatar_provider_failed');
 end loop;
 r:=public.claim_pet_avatar_job_v1(f.jobs[11],f.owner_id);
 if r->>'error'<>'avatar_daily_limit' then raise exception 'eleventh admission accepted: %',r;end if;
 r:=public.claim_pet_avatar_job_v1(f.jobs[1],f.owner_id);
 if r->>'error'<>'avatar_job_closed' then raise exception 'failed duplicate not closed';end if;
end; $$;
reset role;
do $$ declare f record;begin
 select * into f from quota_fixture;
 if (select count(*) from app_private.avatar_mutation_receipts where requester_key=app_private.requester_key(f.owner_id) and started_at is not null)<>10 then raise exception 'failed work did not consume exactly ten';end if;
 delete from public.pets where id=f.pet_id;
 if (select count(*) from app_private.avatar_mutation_receipts where requester_key=app_private.requester_key(f.owner_id) and started_at is not null and deleted)<>10 then raise exception 'pet deletion reset quota evidence';end if;
 update quota_fixture set pet_id=gen_random_uuid();
end; $$;
insert into public.pets(id,owner_id,name,species) select pet_id,owner_id,'Quota again','cat' from quota_fixture;
set local role authenticated;
select set_config('request.jwt.claim.sub',owner_id::text,true) from quota_fixture;
do $$ declare f record;r jsonb;begin
 select * into f from quota_fixture;
 r:=public.prepare_pet_avatar_job(f.pet_id,gen_random_uuid(),gen_random_uuid(),'image/png',24,'avatar-ai-2026-10-31','privacy-2026-10-31');
 update quota_fixture set jobs=array[(r->>'job_id')::uuid];
end; $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
do $$ begin if auth.uid() is not null then raise exception 'service test retained end-user subject';end if;end; $$;
set local role service_role;
do $$ declare f record;r jsonb;begin
 select * into f from quota_fixture;
 r:=public.claim_pet_avatar_job_v1(f.jobs[1],f.owner_id);
 if r->>'error'<>'avatar_daily_limit' then raise exception 'pet recreation bypassed budget';end if;
end; $$;
reset role;
rollback;
select 'exact ten admissions, prepared-only exclusion, failures counted, duplicates and deletion-resistant quota passed' result;
