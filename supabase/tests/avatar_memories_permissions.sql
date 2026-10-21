-- Transaction-local fixtures; assertions use the actual API role and JWT subject.
begin;
create temporary table memory_fixture as select gen_random_uuid() owner_id,gen_random_uuid() caregiver_id,
 gen_random_uuid() sitter_id,gen_random_uuid() outsider_id,gen_random_uuid() partial_id,gen_random_uuid() vet_id,
 gen_random_uuid() other_owner,gen_random_uuid() pet1,gen_random_uuid() pet2,gen_random_uuid() pet3,
 gen_random_uuid() mutation,gen_random_uuid() photo_mutation,gen_random_uuid() photo_asset,
 null::uuid memory_id,null::uuid photo_id,null::uuid job_id,null::uuid avatar_id,null::uuid legacy_entry;
grant all on memory_fixture to authenticated;
create function pg_temp.expect_error(p_sql text,p_state text,p_message text default null) returns void language plpgsql as $$
begin
 begin execute p_sql; exception when others then
 if sqlstate<>p_state or (p_message is not null and sqlerrm<>p_message) then raise; end if; return;
 end;
 raise exception 'Expected error %, SQL: %',p_state,p_sql;
end; $$;
grant execute on function pg_temp.expect_error(text,text,text) to authenticated;
insert into auth.users(id,email) select u.id,'memory-matrix-'||u.id::text||'@example.test' from memory_fixture f,
 lateral unnest(array[f.owner_id,f.caregiver_id,f.sitter_id,f.outsider_id,f.partial_id,f.vet_id,f.other_owner]) u(id);
update public.subscription_entitlements set plan='family' where user_id=(select owner_id from memory_fixture);
insert into public.pets(id,owner_id,name,species)
select pet1,owner_id,'M1 A','dog' from memory_fixture union all select pet2,owner_id,'M1 B','cat' from memory_fixture
union all select pet3,other_owner,'M1 C','cat' from memory_fixture;
insert into public.pet_members(pet_id,user_id,role)
select p.id,f.caregiver_id,'caregiver'::public.pet_member_role from memory_fixture f,lateral unnest(array[f.pet1,f.pet2]) p(id)
union all select p.id,f.sitter_id,'pet_sitter'::public.pet_member_role from memory_fixture f,lateral unnest(array[f.pet1,f.pet2]) p(id);
set local role authenticated;
select set_config('request.jwt.claim.sub',owner_id::text,true) from memory_fixture;
do $$
declare f record;r jsonb;r2 jsonb;
begin
 select * into f from memory_fixture;
 r:=public.prepare_memory(f.mutation,'Our memory',current_date,now(),array[f.pet2,f.pet1],'[]');
 r2:=public.prepare_memory(f.mutation,'Our memory',current_date,now(),array[f.pet1,f.pet2],'[]');
 if r<>r2 then raise exception 'prepare must be idempotent and sort tags'; end if;
 update memory_fixture set memory_id=(r->>'memory_id')::uuid;
 perform pg_temp.expect_error(format('select public.prepare_memory(%L,%L,current_date,now(),%L::uuid[],%L::jsonb)',f.mutation,'changed',array[f.pet1,f.pet2],'[]'),'23505','memory_mutation_conflict');
 perform pg_temp.expect_error(format('select public.prepare_memory(%L,%L,current_date,now(),%L::uuid[],%L::jsonb)',gen_random_uuid(),'mismatch',array[f.pet1,f.pet3],'[]'),'42501','memory_access_denied');
 r:=public.prepare_memory(f.photo_mutation,'Photos',current_date,now(),array[f.pet1,f.pet2],
 jsonb_build_array(jsonb_build_object('asset_id',f.photo_asset,'content_type','image/jpeg','byte_size',100,'position',0)));
 update memory_fixture set photo_id=(r->>'memory_id')::uuid;
 perform pg_temp.expect_error(format('select public.publish_memory(%L,1)',r->>'memory_id'),'22023','memory_invalid_media');
 perform pg_temp.expect_error(format('insert into public.memory_pets values(%L,%L)',r->>'memory_id',f.pet3),'42501');
 perform pg_temp.expect_error(format('delete from public.memory_media where memory_id=%L',r->>'memory_id'),'42501');
 perform pg_temp.expect_error(format('update public.memories set status=%L where id=%L','published',r->>'memory_id'),'42501');
end; $$;
select set_config('request.jwt.claim.sub',caregiver_id::text,true) from memory_fixture;
do $$ begin
 if exists(select 1 from public.memories) or exists(select 1 from public.memory_pets) or exists(select 1 from public.memory_media) then raise exception 'draft leaked to caregiver'; end if;
end; $$;
reset role;
-- Upload through actual authenticated Storage policies with exact DB metadata.
set local role authenticated;
select set_config('request.jwt.claim.sub',owner_id::text,true) from memory_fixture;
insert into storage.objects(bucket_id,name,owner_id,metadata)
select 'memory-media',mm.storage_path,f.owner_id::text,'{"mimetype":"image/jpeg","size":100}' from public.memory_media mm,memory_fixture f where mm.memory_id=f.photo_id;
set constraints storage.resource_storage_completion immediate;
set constraints storage.resource_storage_completion deferred;
do $$ declare f record;r jsonb; begin
 select * into f from memory_fixture;
 r:=public.publish_memory(f.memory_id,1);
 if r->>'status'<>'published' or (r->>'revision')::integer<>2 then raise exception 'publish failed'; end if;
 if public.publish_memory(f.memory_id,1)<>r then raise exception 'publish retry changed result'; end if;
 perform public.publish_memory(f.photo_id,1);
 perform pg_temp.expect_error(format('select public.update_memory(%L,1,%L,current_date,now(),%L::uuid[],%L::uuid[])',f.memory_id,'stale',array[f.pet1,f.pet2],array[]::uuid[]),'40001','memory_revision_conflict');
 perform pg_temp.expect_error(format('insert into storage.objects(bucket_id,name,owner_id,metadata) values(%L,%L,%L,%L::jsonb)','memory-media',f.memory_id::text||'/'||gen_random_uuid()||'/'||gen_random_uuid(),f.owner_id,'{"size":100,"mimetype":"image/jpeg"}'),'42501');
end; $$;
select set_config('request.jwt.claim.sub',caregiver_id::text,true) from memory_fixture;
do $$ declare f record;begin
 select * into f from memory_fixture;
 if (select count(*) from public.memories where id in(f.memory_id,f.photo_id))<>2 then raise exception 'caregiver cannot read published'; end if;
 if (select count(*) from public.memory_pets where memory_id=f.photo_id)<>2 or (select count(*) from public.memory_media where memory_id=f.photo_id)<>1 then raise exception 'junction read failed'; end if;
 if not exists(select 1 from storage.objects where bucket_id='memory-media') then raise exception 'published storage missing'; end if;
 perform pg_temp.expect_error(format('select public.delete_memory(%L,2)',f.memory_id),'42501','memory_access_denied');
 perform pg_temp.expect_error(format('select public.prepare_pet_avatar_job(%L,%L,%L,%L,100,%L,%L)',f.pet1,gen_random_uuid(),gen_random_uuid(),'image/jpeg','v1','v1'),'42501','avatar_owner_required');
end; $$;
-- Active sitter, sanitized-report-only viewer, and unrelated user cannot see any memory surface.
do $$ declare uid uuid; f record; begin
 select * into f from memory_fixture;
 foreach uid in array array[f.sitter_id,f.vet_id,f.outsider_id] loop
 perform set_config('request.jwt.claim.sub',uid::text,true);
 if exists(select 1 from public.memories) or exists(select 1 from public.memory_pets) or exists(select 1 from public.memory_media)
 or exists(select 1 from storage.objects where bucket_id='memory-media') then raise exception 'excluded role leaked memory'; end if;
 perform pg_temp.expect_error(format('select public.prepare_memory(%L,%L,current_date,now(),%L::uuid[],%L::jsonb)',gen_random_uuid(),'forbidden',array[f.pet1],'[]'),'42501','memory_access_denied');
 end loop;
end; $$;
reset role;
insert into public.pet_members(pet_id,user_id,role) select pet1,partial_id,'caregiver' from memory_fixture;
set local role authenticated;
select set_config('request.jwt.claim.sub',partial_id::text,true) from memory_fixture;
do $$ begin
 if exists(select 1 from public.memories) or exists(select 1 from public.memory_pets) or exists(select 1 from public.memory_media)
 or exists(select 1 from storage.objects where bucket_id='memory-media') then raise exception 'partial audience leaked'; end if;
end; $$;
select set_config('request.jwt.claim.sub',owner_id::text,true) from memory_fixture;
do $$ declare f record;begin
 select * into f from memory_fixture;
 perform pg_temp.expect_error(format('select public.prepare_memory(%L,%L,current_date,now(),%L::uuid[],%L::jsonb)',gen_random_uuid(),'mismatch',array[f.pet1,f.pet2],'[]'),'23514','memory_audience_mismatch');
end; $$;
reset role;
delete from public.pet_members where user_id=(select partial_id from memory_fixture);
-- Four legacy + one multi-tag memory exhaust pet1 only; memory counts once for each pet.
insert into public.diary_entries(id,pet_id,created_by,category,entry_date,occurred_at,summary,client_mutation_id)
select gen_random_uuid(),pet1,owner_id,'photo',current_date,now(),'Legacy',gen_random_uuid() from memory_fixture;
update memory_fixture set legacy_entry=(select id from public.diary_entries where pet_id=memory_fixture.pet1);
insert into public.media_assets(pet_id,diary_entry_id,storage_path,content_type,created_by)
select f.pet1,f.legacy_entry,f.pet1::text||'/diary/'||f.legacy_entry::text||'/'||i,'image/jpeg',f.owner_id from memory_fixture f,generate_series(1,4) i;
do $$ declare f record;begin
 select * into f from memory_fixture;
 if app_private.daily_photo_count(f.pet1,current_date)<>5 or app_private.daily_photo_count(f.pet2,current_date)<>1 then raise exception 'combined or multi-tag count wrong'; end if;
end; $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',owner_id::text,true) from memory_fixture;
do $$ declare f record; r jsonb; begin
 select * into f from memory_fixture;
 r:=public.prepare_memory(gen_random_uuid(),'limit',current_date,now(),array[f.pet1],jsonb_build_array(jsonb_build_object('asset_id',gen_random_uuid(),'content_type','image/jpeg','byte_size',100,'position',0)));
 insert into storage.objects(bucket_id,name,owner_id,metadata) select 'memory-media',mm.storage_path,f.owner_id::text,'{"mimetype":"image/jpeg","size":100}' from public.memory_media mm where mm.memory_id=(r->>'memory_id')::uuid;
 set constraints storage.resource_storage_completion immediate;
 set constraints storage.resource_storage_completion deferred;
 perform pg_temp.expect_error(format('select public.publish_memory(%L,1)',r->>'memory_id'),'23514','memory_photo_limit_reached');
 perform public.delete_memory((r->>'memory_id')::uuid,1);
 perform public.delete_memory((r->>'memory_id')::uuid,1);
 perform pg_temp.expect_error(format('select public.update_memory(%L,1,%L,current_date,now(),%L::uuid[],%L::uuid[])',f.photo_id,'cannot double',array[f.pet1,f.pet2],array[f.photo_asset]),'40001','memory_revision_conflict');
 r:=public.prepare_pet_avatar_job(f.pet1,gen_random_uuid(),gen_random_uuid(),'image/jpeg',100,'consent-v1','policy-v1');
 update memory_fixture set job_id=(r->>'job_id')::uuid;
 insert into storage.objects(bucket_id,name,owner_id,metadata) values('pet-avatars',r->>'source_path',f.owner_id::text,'{"mimetype":"image/jpeg","size":100}');
 set constraints storage.resource_storage_completion immediate;
 set constraints storage.resource_storage_completion deferred;
 perform pg_temp.expect_error(format('update public.pet_avatar_jobs set status=%L where id=%L','ready',r->>'job_id'),'42501');
 perform pg_temp.expect_error('select provider_job_id from public.pet_avatar_jobs','42501');
 perform pg_temp.expect_error('select provider_raw from public.pet_avatar_jobs','42501');
 perform pg_temp.expect_error('select provider_error from public.pet_avatar_jobs','42501');
end; $$;
reset role;
-- Memory -> legacy path uses the same total and preserves old public error contract.
insert into storage.objects(bucket_id,name,owner_id,metadata) select 'pet-media',f.pet1::text||'/diary/'||f.legacy_entry::text||'/'||f.mutation::text||'-extra',f.owner_id::text,'{}' from memory_fixture f;
set local role authenticated;
select set_config('request.jwt.claim.sub',owner_id::text,true) from memory_fixture;
do $$ declare f record;begin
 select * into f from memory_fixture;
 perform pg_temp.expect_error(format('select public.update_photo_diary_entry(%L,%L,now(),%L,%L::jsonb)',f.legacy_entry,f.pet1,f.mutation,
 jsonb_build_array(jsonb_build_object('storage_path',f.pet1::text||'/diary/'||f.legacy_entry::text||'/'||f.mutation::text||'-extra','content_type','image/jpeg'))),'23514','Daily diary photo limit is 5.');
end; $$;
reset role;
update public.pet_avatar_jobs set status='ready' where id=(select job_id from memory_fixture);
insert into public.pet_avatars(id,pet_id,job_id,style_version,manifest_version,storage_path,content_type,byte_size,validation_status)
select gen_random_uuid(),pet1,job_id,'style-v1','manifest-v1',pet1::text||'/'||job_id::text||'/'||gen_random_uuid(),'image/png',100,'pending' from memory_fixture;
update memory_fixture set avatar_id=(select id from public.pet_avatars where pet_id=memory_fixture.pet1);
insert into storage.objects(bucket_id,name,metadata) select 'pet-avatars',storage_path,'{"size":100,"mimetype":"image/png"}' from public.pet_avatars where id=(select avatar_id from memory_fixture);
set constraints storage.resource_storage_completion immediate;
set constraints storage.resource_storage_completion deferred;
update public.pet_avatars set validation_status='validated' where id=(select avatar_id from memory_fixture);
set local role authenticated;
select set_config('request.jwt.claim.sub',owner_id::text,true) from memory_fixture;
do $$ declare f record; begin
 select * into f from memory_fixture;
 perform public.apply_pet_avatar(f.pet1,f.avatar_id);
 perform public.apply_pet_avatar(f.pet1,f.avatar_id);
 if (select count(*) from public.pet_avatars where pet_id=f.pet1 and is_applied)<>1 then raise exception 'avatar apply not unique'; end if;
 perform pg_temp.expect_error(format('update public.pet_avatars set validation_status=%L where id=%L','validated',f.avatar_id),'42501');
end; $$;
reset role;
-- Deleting either tag removes the WHOLE memory and preserves all paths in a FK-free queue.
delete from public.pets where id=(select pet2 from memory_fixture);
do $$ declare f record; begin
 select * into f from memory_fixture;
 if exists(select 1 from public.memories where id in(f.memory_id,f.photo_id)) then raise exception 'pet deletion only removed a tag'; end if;
 if not exists(select 1 from app_private.resource_cleanup_jobs where bucket_id='memory-media' and storage_path like f.photo_id::text||'/%') then raise exception 'memory paths lost on cascade'; end if;
 if not exists(select 1 from app_private.memory_mutation_receipts where memory_id=f.memory_id and deleted) then raise exception 'receipt tombstone missing'; end if;
end; $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',owner_id::text,true) from memory_fixture;
do $$ declare f record;begin
 select * into f from memory_fixture;
 perform pg_temp.expect_error(format('select public.publish_memory(%L,2)',f.photo_id),'P0002','memory_not_found');
end; $$;
reset role;
rollback;
select 'avatar/memory authenticated role matrix, limits, storage, deletion assertions passed' result;
