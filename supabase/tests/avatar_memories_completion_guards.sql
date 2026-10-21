begin;
create temporary table completion_fixture as select gen_random_uuid() owner_id,gen_random_uuid() author_id,gen_random_uuid() pet1,gen_random_uuid() pet2,
 gen_random_uuid() asset_id,gen_random_uuid() asset2,null::uuid memory_id,null::uuid memory2,null::text path1,null::text path2;
grant all on completion_fixture to authenticated,service_role;
insert into auth.users(id,email) select u.id,u.id::text||'@completion.test' from completion_fixture f,lateral unnest(array[f.owner_id,f.author_id]) u(id);
update public.subscription_entitlements set plan='family' where user_id=(select owner_id from completion_fixture);
insert into public.pets(id,owner_id,name,species) select pet1,owner_id,'Completion A','dog' from completion_fixture union all select pet2,owner_id,'Completion B','cat' from completion_fixture;
insert into public.pet_members(pet_id,user_id,role) select p.id,f.author_id,'caregiver' from completion_fixture f,lateral unnest(array[f.pet1,f.pet2]) p(id);
set local role authenticated;
select set_config('request.jwt.claim.sub',author_id::text,true) from completion_fixture;
do $$ declare f record;r jsonb;begin
 select * into f from completion_fixture;
 r:=public.prepare_memory(gen_random_uuid(),'private draft',current_date,now(),array[f.pet1],jsonb_build_array(jsonb_build_object('asset_id',f.asset_id,'content_type','image/jpeg','byte_size',100,'position',0)));
 update completion_fixture set memory_id=(r->>'memory_id')::uuid,path1=r->'media'->0->>'storage_path';
 r:=public.prepare_memory(gen_random_uuid(),'guard failures',current_date,now(),array[f.pet1],jsonb_build_array(jsonb_build_object('asset_id',f.asset2,'content_type','image/jpeg','byte_size',100,'position',0)));
 update completion_fixture set memory2=(r->>'memory_id')::uuid,path2=r->'media'->0->>'storage_path';
end; $$;
select set_config('request.jwt.claim.sub',owner_id::text,true) from completion_fixture;
do $$ declare f record;ack jsonb;begin
 select * into f from completion_fixture;
 if exists(select 1 from public.memory_media where memory_id=f.memory_id) then raise exception 'owner can SELECT another authors draft'; end if;
 ack:=public.update_memory(f.memory_id,1,'owner edit',current_date,now(),array[f.pet1],array[f.asset_id]);
 if (select array_agg(k order by k) from jsonb_object_keys(ack) k)<>array['memory_id','revision','status'] or ack->>'status'<>'draft' or (ack->>'revision')::int<>2 then
 raise exception 'owner draft ACK exposed another authors data: %',ack; end if;
end; $$;
-- Actual prepareUpload payload: no size, and RLS probe rolls back before deferred checks execute.
select set_config('request.jwt.claim.sub',author_id::text,true) from completion_fixture;
savepoint storage_probe;
insert into storage.objects(bucket_id,name,owner_id,metadata) select 'memory-media',path1,author_id::text,'{"mimetype":"image/jpeg","contentLength":100}' from completion_fixture;
rollback to storage_probe;
reset role;
do $$ begin if exists(select 1 from storage.objects o,completion_fixture f where o.bucket_id='memory-media' and o.name=f.path1) then raise exception 'probe was not rolled back'; end if;end; $$;
-- Completion bypasses RLS but must validate the actual object's owner, not current JWT subject.
set local role service_role;
select set_config('request.jwt.claim.sub',owner_id::text,true) from completion_fixture;
insert into storage.objects(bucket_id,name,owner_id,metadata) select 'memory-media',path1,author_id::text,'{"mimetype":"image/jpeg","size":100}' from completion_fixture;
set constraints storage.resource_storage_completion immediate;
set constraints storage.resource_storage_completion deferred;
reset role;
do $$ declare f record;begin
 select * into f from completion_fixture;
 begin
 insert into storage.objects(bucket_id,name,owner_id,metadata) values('memory-media',f.path2,f.author_id::text,'{"mimetype":"image/jpeg","contentLength":100}');
 set constraints storage.resource_storage_completion immediate;
 raise exception 'missing final byte size accepted';
 exception when sqlstate '22023' then if sqlerrm<>'resource_storage_invalid_media' then raise;end if;end;
 begin
 insert into storage.objects(bucket_id,name,owner_id,metadata) values('memory-media',f.path2,f.author_id::text,'{"mimetype":"image/jpeg","size":"broken"}');
 set constraints storage.resource_storage_completion immediate;
 raise exception 'non-numeric final byte size accepted';
 exception when sqlstate '22023' then if sqlerrm<>'resource_storage_invalid_media' then raise;end if;end;
 begin
 insert into storage.objects(bucket_id,name,owner_id,metadata) values('memory-media',f.path2,f.owner_id::text,'{"mimetype":"image/jpeg","size":100}');
 set constraints storage.resource_storage_completion immediate;
 raise exception 'forged object owner accepted';
 exception when insufficient_privilege then if sqlerrm<>'resource_storage_access_denied' then raise;end if;end;
 begin
 insert into storage.objects(bucket_id,name,owner_id,metadata) values('memory-media',gen_random_uuid()::text||'/'||gen_random_uuid()||'/'||gen_random_uuid(),f.author_id::text,'{"mimetype":"image/jpeg","size":100}');
 set constraints storage.resource_storage_completion immediate;
 raise exception 'unreserved service object accepted';
 exception when sqlstate '55000' then if sqlerrm<>'resource_storage_reservation_missing' then raise;end if;end;
end; $$;
set constraints storage.resource_storage_completion deferred;
set local role authenticated;
select set_config('request.jwt.claim.sub',author_id::text,true) from completion_fixture;
do $$ declare f record;r jsonb;begin
 select * into f from completion_fixture;
 perform public.publish_memory(f.memory_id,2);
 r:=public.update_memory(f.memory_id,3,'tag added',current_date,now(),array[f.pet2,f.pet1],array[f.asset_id]);
 if (r->>'revision')::int<>4 then raise exception 'published tag change failed';end if;
 r:=public.update_memory(f.memory_id,4,'date moved',current_date+1,now()+interval '1 day',array[f.pet1,f.pet2],array[f.asset_id]);
 if (r->>'revision')::int<>5 then raise exception 'published date change failed';end if;
end; $$;
reset role;
do $$ declare f record;begin
 select * into f from completion_fixture;
 if app_private.daily_photo_count(f.pet1,current_date)<>0 or app_private.daily_photo_count(f.pet2,current_date+1)<>1 then raise exception 'successful tag/date move counted incorrectly';end if;
end; $$;
insert into public.diary_entries(id,pet_id,created_by,category,entry_date,occurred_at,summary,client_mutation_id)
select gen_random_uuid(),pet2,owner_id,'photo',current_date+2,now()+interval '2 days','full day',gen_random_uuid() from completion_fixture;
insert into public.media_assets(pet_id,diary_entry_id,storage_path,content_type,created_by)
select f.pet2,d.id,f.pet2::text||'/diary/'||d.id::text||'/'||i,'image/jpeg',f.owner_id from completion_fixture f join public.diary_entries d on d.pet_id=f.pet2,generate_series(1,5) i;
set local role authenticated;
select set_config('request.jwt.claim.sub',author_id::text,true) from completion_fixture;
do $$ declare f record;begin
 select * into f from completion_fixture;
 begin
 perform public.update_memory(f.memory_id,5,'over limit',current_date+2,now()+interval '2 days',array[f.pet1,f.pet2],array[f.asset_id]);raise exception 'date move bypassed published limit';
 exception when check_violation then if sqlerrm<>'memory_photo_limit_reached' then raise;end if;end;
 if not exists(select 1 from public.memories where id=f.memory_id and revision=5 and entry_date=current_date+1) then raise exception 'failed update did not roll back atomically';end if;
 perform public.update_memory(f.memory_id,5,'tag removed',current_date+2,now()+interval '2 days',array[f.pet1],array[f.asset_id]);
end; $$;
reset role;
do $$ declare f record;begin
 select * into f from completion_fixture;
 if app_private.daily_photo_count(f.pet1,current_date+2)<>1 or app_private.daily_photo_count(f.pet2,current_date+1)<>0 or app_private.daily_photo_count(f.pet2,current_date+2)<>5 then raise exception 'tag removal did not recalculate counts';end if;
end; $$;
rollback;
select 'deferred final Storage checks, probe rollback, draft minimal ACK and published tag/date recount assertions passed' result;
