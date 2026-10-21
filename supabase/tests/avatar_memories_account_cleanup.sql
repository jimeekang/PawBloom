begin;
create temporary table cleanup_fixture as select gen_random_uuid() owner_id,gen_random_uuid() contributor_id,
 gen_random_uuid() pet_id,gen_random_uuid() mutation_id,gen_random_uuid() asset_id,
 null::uuid memory_id,null::text source_path,null::text destination_path,null::uuid deletion_job;
grant all on cleanup_fixture to authenticated;
insert into auth.users(id,email) select id,'memory-cleanup-'||id||'@example.test' from cleanup_fixture f,lateral unnest(array[f.owner_id,f.contributor_id]) u(id);
insert into public.pets(id,owner_id,name,species) select pet_id,owner_id,'Survives contributor deletion','dog' from cleanup_fixture;
insert into public.pet_members(pet_id,user_id,role) select pet_id,contributor_id,'caregiver' from cleanup_fixture;
set local role authenticated;
select set_config('request.jwt.claim.sub',contributor_id::text,true) from cleanup_fixture;
do $$ declare f record; r jsonb; begin
 select * into f from cleanup_fixture;
 r:=public.prepare_memory(f.mutation_id,'A contribution',current_date,now(),array[f.pet_id],jsonb_build_array(jsonb_build_object('asset_id',f.asset_id,'content_type','image/jpeg','byte_size',123,'position',0)));
 update cleanup_fixture set memory_id=(r->>'memory_id')::uuid,source_path=r->'media'->0->>'storage_path';
 insert into storage.objects(bucket_id,name,owner_id,metadata) values('memory-media',r->'media'->0->>'storage_path',f.contributor_id::text,'{"size":123,"mimetype":"image/jpeg"}');
 set constraints storage.resource_storage_completion immediate;
 set constraints storage.resource_storage_completion deferred;
 perform public.publish_memory((r->>'memory_id')::uuid,1);
end; $$;
reset role;
-- The trusted deletion RPC is service-only; use the actual service role for the handoff.
grant all on cleanup_fixture to service_role;
set local role service_role;
update cleanup_fixture set deletion_job=(public.begin_account_deletion_v1(contributor_id)->>'job_id')::uuid;
reset role;
update cleanup_fixture set destination_path=memory_id::text||'/'||deletion_job::text||'/'||gen_random_uuid()::text;
select public.prepare_account_deletion_memory_rehome_v2(contributor_id,asset_id,source_path,destination_path) from cleanup_fixture;
-- Storage API copy is represented by complete object metadata; DB never mutates Storage itself.
insert into storage.objects(bucket_id,name,metadata) select 'memory-media',destination_path,'{"size":123,"mimetype":"image/jpeg"}' from cleanup_fixture;
set constraints storage.resource_storage_completion immediate;
set constraints storage.resource_storage_completion deferred;
set local role service_role;
select public.rehome_account_deletion_memory_v2(contributor_id,asset_id,source_path,destination_path) from cleanup_fixture;
do $$ declare f record;begin
 select * into f from cleanup_fixture;
 if (public.account_deletion_storage_state_v1(f.contributor_id)->>'registered_user_owned_count')::integer<>0 then raise exception 'registered ownership was not cleared'; end if;
 if exists(select 1 from public.list_account_deletion_temporary_objects_v1(f.contributor_id)) then raise exception 'registered ownerless copy incorrectly temporary'; end if;
 perform public.rollback_account_deletion_memory_v2(f.contributor_id,f.asset_id);
end; $$;
reset role;
do $$ declare f record; begin
 select * into f from cleanup_fixture;
 if not exists(select 1 from public.memory_media where id=f.asset_id and storage_path=f.source_path) then raise exception 'rollback did not restore original'; end if;
 if not exists(select 1 from public.list_account_deletion_temporary_objects_v1(f.contributor_id) where name=f.destination_path) then raise exception 'orphan copy not discoverable'; end if;
end; $$;
-- Retry the handoff, then Auth deletion must anonymize the contribution without removing it.
select public.prepare_account_deletion_memory_rehome_v2(contributor_id,asset_id,source_path,destination_path) from cleanup_fixture;
select public.rehome_account_deletion_memory_v2(contributor_id,asset_id,source_path,destination_path) from cleanup_fixture;
delete from auth.users where id=(select contributor_id from cleanup_fixture);
do $$ declare f record;begin
 select * into f from cleanup_fixture;
 if not exists(select 1 from public.memories where id=f.memory_id and created_by is null and status='published') then raise exception 'published contribution did not survive anonymized'; end if;
 if not exists(select 1 from public.memory_media where id=f.asset_id and storage_path=f.destination_path) then raise exception 'ownerless contribution copy lost'; end if;
 if not exists(select 1 from public.pets where id=f.pet_id) then raise exception 'other owners pet was deleted'; end if;
 if not exists(select 1 from app_private.memory_mutation_receipts where memory_id=f.memory_id and not deleted
 and octet_length(requester_key)=32) then raise exception 'non-identifying mutation receipt lost'; end if;
end; $$;
-- Deleted JWT cannot re-enter a command; NULL author cannot accidentally authorize a non-owner.
set local role authenticated;
select set_config('request.jwt.claim.sub',contributor_id::text,true) from cleanup_fixture;
do $$ declare f record;begin
 select * into f from cleanup_fixture;
 begin perform public.prepare_memory(f.mutation_id,'A contribution',current_date,now(),array[f.pet_id],'[]'); raise exception 'deleted JWT accepted';
 exception when insufficient_privilege then null; end;
 begin perform public.delete_memory(f.memory_id,2); raise exception 'anonymous creator authorized a deleted JWT';
 exception when insufficient_privilege then null; end;
end; $$;
reset role;
-- Cleanup queue ACK is idempotent and must not acknowledge an existing Storage object.
delete from public.pets where id=(select pet_id from cleanup_fixture);
do $$ declare f record;begin
 select * into f from cleanup_fixture;
 if not exists(select 1 from app_private.resource_cleanup_jobs where bucket_id='memory-media' and storage_path=f.destination_path) then raise exception 'delete lost rehomed copy path'; end if;
 begin perform public.complete_resource_cleanup_v1('memory-media',f.destination_path); raise exception 'early ACK accepted';
 exception when sqlstate '55000' then if sqlerrm<>'resource_cleanup_incomplete' then raise; end if; end;
end; $$;
-- Missing-object retries are safe; no fixture bypass of managed Storage deletion guards.
insert into app_private.resource_cleanup_jobs(bucket_id,storage_path) select 'memory-media',destination_path||'-already-removed' from cleanup_fixture;
select public.complete_resource_cleanup_v1('memory-media',destination_path||'-already-removed') from cleanup_fixture;
select public.complete_resource_cleanup_v1('memory-media',destination_path||'-already-removed') from cleanup_fixture;
rollback;
select 'account contribution rehome/rollback/anonymization and durable cleanup assertions passed' result;
