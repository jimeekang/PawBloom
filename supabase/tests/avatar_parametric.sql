begin;
create temporary table avatar_fixture as select gen_random_uuid() owner_id,gen_random_uuid() other_id,gen_random_uuid() pet_id,
 null::uuid job_id,null::uuid avatar_id,null::uuid legacy_job,null::uuid legacy_avatar;
grant all on avatar_fixture to authenticated,service_role;
insert into auth.users(id,email) select id,id::text||'@parametric.test' from avatar_fixture,lateral unnest(array[owner_id,other_id]) u(id);
insert into public.pets(id,owner_id,name,species) select pet_id,owner_id,'Parametric','cat' from avatar_fixture;
set local role authenticated;
select set_config('request.jwt.claim.sub',owner_id::text,true) from avatar_fixture;
do $$ declare f record;r jsonb;begin
 select * into f from avatar_fixture;
 r:=public.prepare_pet_avatar_job(f.pet_id,gen_random_uuid(),gen_random_uuid(),'image/png',24,'avatar-ai-2026-11-01','privacy-2026-11-01');
 update avatar_fixture set job_id=(r->>'job_id')::uuid;
 begin perform public.claim_pet_avatar_job_v1((r->>'job_id')::uuid,f.owner_id);raise exception 'authenticated called admission';exception when insufficient_privilege then null;end;
 begin perform public.finish_pet_avatar_job_v1((r->>'job_id')::uuid,f.owner_id,null,null,'avatar_provider_failed');raise exception 'authenticated finalized';exception when insufficient_privilege then null;end;
end; $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
do $$ begin if auth.uid() is not null then raise exception 'service test retained end-user subject';end if;end; $$;
set local role service_role;
do $$ declare f record;r jsonb;begin
 select * into f from avatar_fixture;
 r:=public.claim_pet_avatar_job_v1(f.job_id,f.other_id);
 if r->>'error'<>'avatar_not_found' then raise exception 'non-requester admitted';end if;
 r:=public.claim_pet_avatar_job_v1(f.job_id,f.owner_id);
 if r->>'status'<>'processing' then raise exception 'first admission failed: %',r;end if;
 r:=public.claim_pet_avatar_job_v1(f.job_id,f.owner_id);
 if r->>'error'<>'avatar_in_progress' then raise exception 'concurrent duplicate admitted';end if;
 perform public.finish_pet_avatar_job_v1(f.job_id,f.owner_id,
 '{"species":"cat","confidence":0.9,"appearance":{"version":1,"coatColor":"gray","coatPattern":"solid","accentColor":"black","eyeColor":"amber","earShape":"pointed","furLength":"short","build":"regular","tail":"long","faceMark":"none","collar":"none"},"rationale":"MUST NOT STORE"}',
 '{"model":"untrusted","stop_reason":"completed","usage":{"input_tokens":123,"output_tokens":456,"secret":"PRIVATE"},"request_id":"req-1","photo":"PRIVATE","prompt":"PRIVATE"}',null);
 r:=public.claim_pet_avatar_job_v1(f.job_id,f.owner_id);
 if r->>'status'<>'ready' then raise exception 'ready retry changed status';end if;
 update avatar_fixture set avatar_id=(select id from public.pet_avatars where job_id=f.job_id);
end; $$;
reset role;
do $$ declare f record;r jsonb;begin
 select * into f from avatar_fixture;
 if not exists(select 1 from app_private.resource_cleanup_jobs q join public.pet_avatar_jobs j on q.storage_path=j.source_path where j.id=f.job_id) then raise exception 'source deletion not durable';end if;
 select provider_raw into r from public.pet_avatar_jobs where id=f.job_id;
 if (select array_agg(k order by k) from jsonb_object_keys(r) k)<>array['model','request_id','stop_reason','usage']
 or r->>'model'<>'gpt-6.1-sol' or r::text like '%PRIVATE%' then raise exception 'provider_raw allowlist failure: %',r;end if;
 if (select manifest->'provider' from public.pet_avatars where id=f.avatar_id) is distinct from '{"name":"openai","model":"gpt-6.1-sol"}'::jsonb then raise exception 'manifest provider not openai';end if;
 if (select manifest::text from public.pet_avatars where id=f.avatar_id) like '%MUST NOT STORE%' then raise exception 'rationale stored';end if;
 insert into public.pet_avatars(pet_id,job_id,style_version,manifest_version,manifest,validation_status)
 select pet_id,job_id,style_version,manifest_version,manifest,validation_status from public.pet_avatars where id=f.avatar_id;
 if (select count(*) from public.pet_avatars where job_id=f.job_id and storage_path is null)<>2 then raise exception 'multiple parametric NULL paths rejected';end if;
 delete from public.pet_avatars where job_id=f.job_id and id<>f.avatar_id;
 begin update public.pet_avatars set manifest='{}' where id=f.avatar_id;raise exception 'NULL-expression CHECK accepted missing fields';exception when check_violation then null;end;
 begin update public.pet_avatars set manifest='{"appearance":null,"species":"cat"}' where id=f.avatar_id;raise exception 'null appearance accepted';exception when check_violation then null;end;
 begin update public.pet_avatars set storage_path=f.pet_id::text||'/'||f.job_id::text||'/'||gen_random_uuid() where id=f.avatar_id;raise exception 'parametric with asset accepted';exception when check_violation then null;end;
 begin update public.pet_avatars set manifest='{"appearance":[],"species":"cat"}' where id=f.avatar_id;raise exception 'array appearance accepted';exception when check_violation then null;end;
 begin update public.pet_avatars set manifest='{"appearance":{}}' where id=f.avatar_id;raise exception 'missing species accepted';exception when check_violation then null;end;
 begin update public.pet_avatars set manifest='{"appearance":{},"species":"bird"}' where id=f.avatar_id;raise exception 'invalid species accepted';exception when check_violation then null;end;
 begin update public.pet_avatars set byte_size=1 where id=f.avatar_id;raise exception 'parametric with bytes accepted';exception when check_violation then null;end;
 begin update public.pet_avatars set content_type='image/png' where id=f.avatar_id;raise exception 'parametric with MIME accepted';exception when check_violation then null;end;
end; $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',owner_id::text,true) from avatar_fixture;
select public.apply_pet_avatar(pet_id,avatar_id) from avatar_fixture;
do $$ declare f record;r jsonb;begin
 select * into f from avatar_fixture;
 if not exists(select 1 from public.pet_avatars where id=f.avatar_id and is_applied) then raise exception 'parametric apply without Storage failed';end if;
 r:=public.prepare_pet_avatar_job(f.pet_id,gen_random_uuid(),gen_random_uuid(),'image/jpeg',100,'v1','v1');
 update avatar_fixture set legacy_job=(r->>'job_id')::uuid;
end; $$;
select set_config('request.jwt.claim.sub',other_id::text,true) from avatar_fixture;
do $$ declare f record;begin
 select * into f from avatar_fixture;
 begin perform public.apply_pet_avatar(f.pet_id,f.avatar_id);raise exception 'non-owner applied';exception when insufficient_privilege then null;end;
end; $$;
reset role;
update public.pet_avatar_jobs set status='ready' where id=(select legacy_job from avatar_fixture);
insert into public.pet_avatars(pet_id,job_id,style_version,manifest_version,storage_path,content_type,byte_size,validation_status)
select pet_id,legacy_job,'v1','v1',pet_id::text||'/'||legacy_job::text||'/'||gen_random_uuid(),'image/jpeg',100,'validated' from avatar_fixture;
update avatar_fixture set legacy_avatar=(select id from public.pet_avatars where job_id=legacy_job);
do $$ declare f record;begin
 select * into f from avatar_fixture;
 begin update public.pet_avatars set storage_path=null where id=f.legacy_avatar;raise exception 'legacy NULL path accepted';exception when check_violation then null;end;
 begin update public.pet_avatars set storage_path='invalid/path' where id=f.legacy_avatar;raise exception 'legacy regex weakened';exception when check_violation then null;end;
 begin update public.pet_avatars set byte_size=0 where id=f.legacy_avatar;raise exception 'legacy positive bytes weakened';exception when check_violation then null;end;
 begin update public.pet_avatars set byte_size=-1 where id=f.legacy_avatar;raise exception 'legacy negative bytes accepted';exception when check_violation then null;end;
 begin update public.pet_avatars set is_applied=true,validation_status='pending' where id=f.legacy_avatar;raise exception 'applied validation guard weakened';exception when check_violation then null;end;
 begin update public.pet_avatars set is_applied=true,validation_status='rejected' where id=f.legacy_avatar;raise exception 'applied rejected accepted';exception when check_violation then null;end;
 begin
 insert into public.pet_avatars(pet_id,job_id,style_version,manifest_version,storage_path,content_type,byte_size)
 select pet_id,job_id,style_version,manifest_version,storage_path,content_type,byte_size from public.pet_avatars where id=f.legacy_avatar;
 raise exception 'non-null path uniqueness weakened';exception when unique_violation then null;end;
end; $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',owner_id::text,true) from avatar_fixture;
do $$ declare f record;begin
 select * into f from avatar_fixture;
 begin perform public.apply_pet_avatar(f.pet_id,f.legacy_avatar);raise exception 'legacy skipped Storage';exception when sqlstate '55000' then if sqlerrm<>'avatar_not_ready' then raise;end if;end;
end; $$;
reset role;
-- Legacy Storage completion requires the existing pending -> upload -> validated order.
update public.pet_avatars set validation_status='pending' where id=(select legacy_avatar from avatar_fixture);
insert into storage.objects(bucket_id,name,metadata) select 'pet-avatars',storage_path,'{"size":100,"mimetype":"image/jpeg"}' from public.pet_avatars where id=(select legacy_avatar from avatar_fixture);
set constraints storage.resource_storage_completion immediate;
set constraints storage.resource_storage_completion deferred;
update public.pet_avatars set validation_status='validated' where id=(select legacy_avatar from avatar_fixture);
set local role authenticated;
select set_config('request.jwt.claim.sub',owner_id::text,true) from avatar_fixture;
select public.apply_pet_avatar(pet_id,legacy_avatar) from avatar_fixture;
reset role;
delete from public.pet_avatars where id=(select avatar_id from avatar_fixture);
do $$ begin
 if exists(select 1 from app_private.resource_cleanup_jobs where storage_path is null) then raise exception 'NULL path was queued';end if;
end; $$;
rollback;
select 'parametric apply/legacy Storage gate/strict CHECK/NULL cleanup/authority/raw allowlist passed' result;
