begin;
create temporary table boundary_fixture as select gen_random_uuid() owner_id,gen_random_uuid() pet_id,gen_random_uuid() mutation_id,
 null::uuid memory_id,null::uuid job_id,null::uuid avatar1,null::uuid avatar2;
grant all on boundary_fixture to authenticated;
insert into auth.users(id,email) select owner_id,owner_id::text||'@boundary.test' from boundary_fixture;
insert into public.pets(id,owner_id,name,species) select pet_id,owner_id,'Boundaries','dog' from boundary_fixture;
create function pg_temp.assert_error(p_sql text,p_state text,p_message text) returns void language plpgsql as $$
begin begin execute p_sql; exception when others then if sqlstate<>p_state or sqlerrm<>p_message then raise; end if; return;end;
 raise exception 'expected %, %',p_state,p_message; end; $$;
grant execute on function pg_temp.assert_error(text,text,text) to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub',owner_id::text,true) from boundary_fixture;
do $$ declare f record;r jsonb;i integer; media jsonb; begin
 select * into f from boundary_fixture;
 perform pg_temp.assert_error(format('select public.prepare_memory(%L,%L,current_date,now(),%L::uuid[],%L::jsonb)',gen_random_uuid(),' ',array[f.pet_id],'[]'),'22023','memory_invalid_media');
 perform pg_temp.assert_error(format('select public.prepare_memory(%L,%L,current_date+10,now(),%L::uuid[],%L::jsonb)',gen_random_uuid(),'invalid date',array[f.pet_id],'[]'),'22023','memory_invalid_local_date');
 media:=jsonb_build_array(jsonb_build_object('asset_id',gen_random_uuid(),'content_type','image/gif','byte_size',100,'position',0));
 perform pg_temp.assert_error(format('select public.prepare_memory(%L,%L,current_date,now(),%L::uuid[],%L::jsonb)',gen_random_uuid(),'bad MIME',array[f.pet_id],media),'22023','memory_invalid_media');
 media:=jsonb_build_array(jsonb_build_object('asset_id',gen_random_uuid(),'content_type','image/jpeg','byte_size',10485761,'position',0));
 perform pg_temp.assert_error(format('select public.prepare_memory(%L,%L,current_date,now(),%L::uuid[],%L::jsonb)',gen_random_uuid(),'oversize',array[f.pet_id],media),'22023','memory_invalid_media');
 r:=public.prepare_memory(f.mutation_id,'v1',current_date,now(),array[f.pet_id],'[]');
 update boundary_fixture set memory_id=(r->>'memory_id')::uuid;
 r:=public.update_memory((r->>'memory_id')::uuid,1,'v2',current_date+1,now()+interval '1 day',array[f.pet_id],array[]::uuid[]);
 if (r->>'revision')::integer<>2 then raise exception 'update did not advance revision'; end if;
 for i in 1..9 loop perform public.prepare_memory(gen_random_uuid(),'draft',current_date,now(),array[f.pet_id],'[]');end loop;
 perform pg_temp.assert_error(format('select public.prepare_memory(%L,%L,current_date,now(),%L::uuid[],%L::jsonb)',gen_random_uuid(),'over budget',array[f.pet_id],'[]'),'23514','memory_draft_budget_exceeded');
end; $$;
reset role;
update public.memories set draft_expires_at=now()-interval '1 second' where id=(select memory_id from boundary_fixture);
set local role authenticated;
select set_config('request.jwt.claim.sub',owner_id::text,true) from boundary_fixture;
do $$ declare f record;begin
 select * into f from boundary_fixture;
 perform pg_temp.assert_error(format('select public.publish_memory(%L,2)',f.memory_id),'55000','memory_draft_expired');
end; $$;
reset role;
select public.expire_memory_drafts_v1(100);
set local role authenticated;
select set_config('request.jwt.claim.sub',owner_id::text,true) from boundary_fixture;
do $$ declare f record;r jsonb;begin
 select * into f from boundary_fixture;
 perform pg_temp.assert_error(format('select public.prepare_memory(%L,%L,current_date,now(),%L::uuid[],%L::jsonb)',f.mutation_id,'v1',array[f.pet_id],'[]'),'55000','memory_deleted');
 r:=public.prepare_pet_avatar_job(f.pet_id,gen_random_uuid(),gen_random_uuid(),'image/jpeg',100,'v1','v1');update boundary_fixture set job_id=(r->>'job_id')::uuid;
end; $$;
reset role;
update public.pet_avatar_jobs set status='ready' where id=(select job_id from boundary_fixture);
insert into public.pet_avatars(id,pet_id,job_id,style_version,manifest_version,storage_path,content_type,byte_size,validation_status)
select gen_random_uuid(),pet_id,job_id,'v1','v1',pet_id::text||'/'||job_id::text||'/'||gen_random_uuid(),'image/jpeg',100,'pending' from boundary_fixture,generate_series(1,2);
update boundary_fixture set avatar1=(select min(id::text)::uuid from public.pet_avatars where pet_id=boundary_fixture.pet_id),avatar2=(select max(id::text)::uuid from public.pet_avatars where pet_id=boundary_fixture.pet_id);
insert into storage.objects(bucket_id,name,metadata) select 'pet-avatars',storage_path,'{"size":100,"mimetype":"image/jpeg"}' from public.pet_avatars where pet_id=(select pet_id from boundary_fixture);
set constraints storage.resource_storage_completion immediate;
set constraints storage.resource_storage_completion deferred;
update public.pet_avatars set validation_status='validated' where pet_id=(select pet_id from boundary_fixture);
set local role authenticated;
select set_config('request.jwt.claim.sub',owner_id::text,true) from boundary_fixture;
select public.apply_pet_avatar(pet_id,avatar1) from boundary_fixture;
select public.apply_pet_avatar(pet_id,avatar2) from boundary_fixture;
reset role;
do $$ declare f record;begin
 select * into f from boundary_fixture;
 if (select count(*) from public.pet_avatars where pet_id=f.pet_id and is_applied)<>1 or not exists(select 1 from public.pet_avatars where id=f.avatar2 and is_applied) then raise exception 'replacement did not preserve one applied avatar'; end if;
 begin update public.pet_avatars set is_applied=true where id=f.avatar1;raise exception 'two applied avatars allowed';exception when unique_violation then null;end;
end; $$;
rollback;
select 'RPC validation, draft budgets/expiry, tombstones, revision and avatar replacement assertions passed' result;
