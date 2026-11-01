begin;
create temporary table avatar_authority as select gen_random_uuid() owner_id,gen_random_uuid() other_id,gen_random_uuid() pet_id,null::uuid job_id;
grant all on avatar_authority to authenticated,service_role;
insert into auth.users(id,email) select id,id::text||'@avatar-authority.test' from avatar_authority,lateral unnest(array[owner_id,other_id]) u(id);
insert into public.pets(id,owner_id,name,species) select pet_id,owner_id,'Avatar authority','cat' from avatar_authority;
set local role authenticated;
select set_config('request.jwt.claim.sub',owner_id::text,true) from avatar_authority;
update avatar_authority set job_id=(public.prepare_pet_avatar_job(pet_id,gen_random_uuid(),gen_random_uuid(),'image/png',24,'avatar-ai-2026-11-01','privacy-2026-11-01')->>'job_id')::uuid;
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
do $$ declare f record;r text;begin
 select * into f from avatar_authority;
 if auth.uid() is not null then raise exception 'service test retained subject';end if;
 foreach r in array array['anon','authenticated'] loop
 if has_function_privilege(r,'public.claim_pet_avatar_job_v1(uuid,uuid)','EXECUTE')
 or has_function_privilege(r,'public.finish_pet_avatar_job_v1(uuid,uuid,jsonb,jsonb,text)','EXECUTE')
 or has_function_privilege(r,'public.queue_pet_avatar_source_cleanup_v1(uuid,uuid)','EXECUTE')
 or has_function_privilege(r,'app_private.assert_avatar_generation_account(uuid[],uuid)','EXECUTE') then raise exception 'client can execute server boundary';end if;
 end loop;
 begin perform app_private.assert_avatar_generation_account(array[f.pet_id],null);raise exception 'NULL requester accepted';exception when insufficient_privilege then null;end;
 begin perform app_private.assert_avatar_generation_account(array[f.pet_id],gen_random_uuid());raise exception 'nonexistent requester accepted';exception when insufficient_privilege then null;end;
 insert into app_private.account_deletion_jobs(user_id) values(f.other_id);
 begin perform app_private.assert_avatar_generation_account(array[f.pet_id],f.other_id);raise exception 'deleting requester accepted';exception when sqlstate '55000' then if sqlerrm<>'account_deletion_in_progress' then raise;end if;end;
 delete from app_private.account_deletion_jobs where user_id=f.other_id;
 insert into app_private.account_deletion_jobs(user_id) values(f.owner_id);
 begin perform app_private.assert_avatar_generation_account(array[f.pet_id],f.other_id);raise exception 'deleting pet owner accepted';exception when sqlstate '55000' then if sqlerrm<>'account_deletion_in_progress' then raise;end if;end;
end; $$;
set local role service_role;
do $$ declare f record;r jsonb;begin
 select * into f from avatar_authority;
 begin perform public.claim_pet_avatar_job_v1(f.job_id,f.owner_id);raise exception 'claim accepted deleting account';exception when sqlstate '55000' then if sqlerrm<>'account_deletion_in_progress' then raise;end if;end;
 r:=public.claim_pet_avatar_job_v1(f.job_id,f.other_id);
 if r->>'error'<>'avatar_not_found' then raise exception 'nonrequester learned job';end if;
 r:=public.claim_pet_avatar_job_v1(f.job_id,null);
 if r->>'error'<>'avatar_not_found' then raise exception 'NULL requester found job';end if;
end; $$;
reset role;
delete from app_private.account_deletion_jobs where user_id=(select owner_id from avatar_authority);
set local role service_role;
select public.claim_pet_avatar_job_v1(job_id,owner_id)->>'status' from avatar_authority;
reset role;
insert into app_private.account_deletion_jobs(user_id) select owner_id from avatar_authority;
set local role service_role;
do $$ declare f record;begin
 select * into f from avatar_authority;
 begin perform public.finish_pet_avatar_job_v1(f.job_id,f.owner_id,null,null,'avatar_provider_failed');raise exception 'finish accepted deleting account';exception when sqlstate '55000' then if sqlerrm<>'account_deletion_in_progress' then raise;end if;end;
end; $$;
reset role;
rollback;
select 'service JWT without sub, explicit requester/account-deletion barriers and client execute denial passed' result;
