-- Additive M1 contract. All client mutations use invoker RPCs backed by private commands.
create table app_private.memory_limits (
  singleton boolean primary key default true check (singleton),
  max_photos integer not null default 5,
  max_file_bytes bigint not null default 10485760,
  max_drafts integer not null default 10,
  draft_ttl interval not null default interval '24 hours',
  mime_types text[] not null default array['image/jpeg','image/png','image/webp']
);
insert into app_private.memory_limits default values;
create table app_private.mutation_secret (
  singleton boolean primary key default true check (singleton),
  secret bytea not null default extensions.gen_random_bytes(32)
);
insert into app_private.mutation_secret default values;
revoke all on app_private.memory_limits, app_private.mutation_secret from public, anon, authenticated, service_role;

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  content text not null default '' check (char_length(content) <= 2000),
  entry_date date not null,
  occurred_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','published')),
  revision integer not null default 1 check (revision > 0),
  client_mutation_id uuid not null,
  draft_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (app_private.matches_local_entry_date(occurred_at, entry_date))
);
create index memories_created_by_idx on public.memories(created_by);
create index memories_feed_idx on public.memories(status,entry_date desc,occurred_at desc,id);
create index memories_draft_expiry_idx on public.memories(draft_expires_at) where status='draft';
create table public.memory_pets (
  memory_id uuid not null references public.memories(id) on delete cascade,
  pet_id uuid not null references public.pets(id),
  primary key(memory_id,pet_id)
);
create index memory_pets_pet_memory_idx on public.memory_pets(pet_id,memory_id);
create table public.memory_media (
  id uuid primary key,
  memory_id uuid not null references public.memories(id) on delete cascade,
  storage_path text not null unique check(storage_path ~ ('^'||memory_id::text||'/[0-9a-f-]{36}/[0-9a-f-]{36}$')),
  content_type text not null,
  byte_size bigint not null check(byte_size>0),
  position integer not null check(position>=0),
  client_mutation_id uuid not null,
  cleanup_status text not null default 'reserved' check(cleanup_status in ('reserved','referenced')),
  created_at timestamptz not null default now(),
  unique(memory_id,position)
);
create table app_private.memory_mutation_receipts (
  requester_key bytea not null,
  client_mutation_id uuid not null,
  memory_id uuid not null unique,
  payload_hash bytea not null,
  deleted boolean not null default false,
  primary key(requester_key,client_mutation_id)
);
create table public.pet_avatar_jobs (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  requester_id uuid references auth.users(id) on delete set null,
  client_mutation_id uuid not null,
  source_path text not null unique check(source_path ~ ('^'||pet_id::text||'/'||id::text||'/[0-9a-f-]{36}$')),
  source_content_type text not null,
  source_byte_size bigint not null check(source_byte_size>0),
  consent_version text not null,
  policy_version text not null,
  provider_job_id text,
  provider_raw jsonb,
  provider_error text,
  status text not null default 'queued' check(status in ('queued','processing','ready','failed','cancelled')),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(id,pet_id),
  unique(requester_id,client_mutation_id)
);
create index pet_avatar_jobs_pet_idx on public.pet_avatar_jobs(pet_id,created_at desc);
create index pet_avatar_jobs_requester_idx on public.pet_avatar_jobs(requester_id);
create table public.pet_avatars (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  job_id uuid not null,
  style_version text not null,
  manifest_version text not null,
  manifest jsonb not null default '{}',
  storage_path text not null unique check(storage_path ~ ('^'||pet_id::text||'/'||job_id::text||'/[0-9a-f-]{36}$')),
  content_type text not null,
  byte_size bigint not null check(byte_size>0),
  validation_status text not null default 'pending' check(validation_status in ('pending','validated','rejected')),
  is_applied boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key(job_id,pet_id) references public.pet_avatar_jobs(id,pet_id) on delete cascade,
  check(not is_applied or validation_status='validated')
);
create unique index pet_avatars_one_applied_idx on public.pet_avatars(pet_id) where is_applied;
create index pet_avatars_job_idx on public.pet_avatars(job_id,pet_id);
create table app_private.avatar_mutation_receipts (
  requester_key bytea not null,
  client_mutation_id uuid not null,
  job_id uuid not null unique,
  payload_hash bytea not null,
  deleted boolean not null default false,
  primary key(requester_key,client_mutation_id)
);
-- No user/parent FK: these paths survive Auth and pet cascades until Storage acknowledges removal.
create table app_private.resource_cleanup_jobs (
  bucket_id text not null check(bucket_id in ('memory-media','pet-avatars')),
  storage_path text not null,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(bucket_id,storage_path)
);
revoke all on app_private.memory_mutation_receipts,app_private.avatar_mutation_receipts,app_private.resource_cleanup_jobs from public,anon,authenticated;
grant select,insert,update,delete on app_private.resource_cleanup_jobs to service_role;

-- Routine writes share the structure barrier; only rare identity/account changes take it exclusively.
-- Storage completion takes its object locks first, then this gate; app writes only read Storage.
-- RowExclusive table locks acquired before statement triggers are mutually compatible.
create or replace function app_private.lock_pet_resource_writes()
returns void language sql volatile security definer set search_path='' as $$
 select pg_catalog.pg_advisory_xact_lock_shared(1346459468,1295070001);
$$;
revoke all on function app_private.lock_pet_resource_writes() from public,anon,authenticated;
create or replace function app_private.serialize_pet_resource_statement()
returns trigger language plpgsql volatile security definer set search_path='' as $$
begin
 perform app_private.lock_pet_resource_writes();
 return null;
end; $$;
revoke all on function app_private.serialize_pet_resource_statement() from public,anon,authenticated;

-- Acquire the exclusive barrier before any tuple locks; never upgrade a routine write.
create or replace function app_private.lock_pet_resource_structure()
returns void language sql volatile security definer set search_path='' as $$
 select pg_catalog.pg_advisory_xact_lock(1346459468,1295070001);
$$;
revoke all on function app_private.lock_pet_resource_structure() from public,anon,authenticated;
create or replace function app_private.serialize_pet_resource_structure()
returns trigger language plpgsql volatile security definer set search_path='' as $$
begin
 perform app_private.lock_pet_resource_structure();
 return null;
end; $$;
revoke all on function app_private.serialize_pet_resource_structure() from public,anon,authenticated;
alter function app_private.has_pet_role(uuid,uuid,public.pet_member_role[]) volatile;

create or replace function app_private.requester_key(p_user_id uuid)
returns bytea language sql stable security definer set search_path='' as $$
 select extensions.hmac('pawbloom-memory-requester-v1:'||p_user_id::text,encode(secret,'hex'),'sha256') from app_private.mutation_secret;
$$;
create or replace function app_private.care_access(p_pet_id uuid,p_user_id uuid)
returns boolean language sql volatile security definer set search_path='' as $$
 select p_user_id is not null and exists(select 1 from public.pets p where p.id=p_pet_id and
 (p.owner_id=p_user_id or exists(select 1 from public.pet_members pm where pm.pet_id=p.id and pm.user_id=p_user_id
 and pm.role='caregiver' and (pm.starts_at is null or pm.starts_at<=now()) and (pm.ends_at is null or pm.ends_at>=now()))));
$$;
create or replace function app_private.all_care_access(p_pet_ids uuid[],p_user_id uuid)
returns boolean language sql volatile security definer set search_path='' as $$
 select coalesce(cardinality(p_pet_ids)>0,false) and not exists(select 1 from unnest(p_pet_ids) p(id) where not app_private.care_access(p.id,p_user_id));
$$;
create or replace function app_private.all_pet_owner(p_pet_ids uuid[],p_user_id uuid)
returns boolean language sql volatile security definer set search_path='' as $$
 select coalesce(cardinality(p_pet_ids)>0,false) and not exists(select 1 from unnest(p_pet_ids) t(id)
 where not exists(select 1 from public.pets p where p.id=t.id and p.owner_id=p_user_id));
$$;
create or replace function app_private.same_memory_audience(p_pet_ids uuid[])
returns boolean language sql volatile security definer set search_path='' as $$
 with audience as (
 select p.id, array(select u.id from (
 select p.owner_id as id union select pm.user_id from public.pet_members pm
 where pm.pet_id=p.id and pm.role='caregiver' and (pm.starts_at is null or pm.starts_at<=now())
 and (pm.ends_at is null or pm.ends_at>=now())) u order by u.id) users
 from public.pets p where p.id=any(p_pet_ids))
 select (select count(*) from audience)=cardinality(p_pet_ids) and (select count(distinct users) from audience)=1;
$$;
create or replace function app_private.memory_pet_ids(p_memory_id uuid)
returns uuid[] language sql volatile security definer set search_path='' as $$
 select coalesce(array_agg(pet_id order by pet_id),'{}'::uuid[]) from public.memory_pets where memory_id=p_memory_id;
$$;
create or replace function app_private.can_read_memory(p_memory_id uuid)
returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from public.memories m where m.id=p_memory_id
 and (m.status='published' or m.created_by=(select auth.uid()))
 and app_private.all_care_access(app_private.memory_pet_ids(m.id),(select auth.uid())));
$$;
-- Drop every lock from a failed attempt before waiting on one blocker. This also
-- handles a single bulk membership statement whose physical row order differs.
create or replace function app_private.lock_memory_pets(p_pet_ids uuid[])
returns void language plpgsql security definer set search_path='' as $$
declare target uuid; blocked_id uuid; blocked_kind text;
begin
 perform app_private.lock_pet_resource_writes();
 loop
 begin
  for target in select id from public.pets where id=any(p_pet_ids) order by id loop
   blocked_kind:='pet'; blocked_id:=target;
   perform id from public.pets where id=target for update nowait;
  end loop;
  for target in select id from public.pet_members where pet_id=any(p_pet_ids) order by pet_id,id loop
   blocked_kind:='member'; blocked_id:=target;
   perform id from public.pet_members where id=target for share nowait;
  end loop;
  return;
 exception when lock_not_available then
  -- The exception subtransaction released this attempt's pets and members.
 end;
 begin
  if blocked_kind='pet' then
   perform id from public.pets where id=blocked_id for update;
  else
   perform id from public.pet_members where id=blocked_id for share;
  end if;
  raise exception 'release_pet_resource_lock_probe' using errcode='PZ001';
 exception when sqlstate 'PZ001' then null;
 end;
 end loop;
end; $$;

create or replace function app_private.lock_pet_members_for_delete(p_pet_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare target uuid; blocked_id uuid;
begin
 loop
 begin
  for target in select id from public.pet_members where pet_id=p_pet_id order by id loop
   blocked_id:=target;
   perform id from public.pet_members where id=target for update nowait;
  end loop;
  return;
 exception when lock_not_available then null;
 end;
 begin
  perform id from public.pet_members where id=blocked_id for update;
  raise exception 'release_pet_resource_lock_probe' using errcode='PZ001';
 exception when sqlstate 'PZ001' then null;
 end;
 end loop;
end; $$;
revoke all on function app_private.lock_pet_members_for_delete(uuid) from public,anon,authenticated;
create or replace function app_private.assert_memory_account(p_pet_ids uuid[])
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid()) then
 raise exception 'memory_access_denied' using errcode='42501'; end if;
 if exists(select 1 from app_private.account_deletion_jobs j where j.user_id=auth.uid()
 or exists(select 1 from public.pets p where p.id=any(p_pet_ids) and p.owner_id=j.user_id)) then
 raise exception 'account_deletion_in_progress' using errcode='55000'; end if;
end; $$;
create or replace function app_private.validate_memory_input(p_content text,p_entry_date date,p_occurred_at timestamptz,p_pet_ids uuid[])
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_content is null or char_length(p_content)>2000 or p_pet_ids is null or cardinality(p_pet_ids)=0
 or array_position(p_pet_ids,null) is not null or cardinality(p_pet_ids)<>(select count(distinct id) from unnest(p_pet_ids) t(id)) then
 raise exception 'memory_invalid_input' using errcode='22023'; end if;
 if not app_private.matches_local_entry_date(p_occurred_at,p_entry_date) then
 raise exception 'memory_invalid_local_date' using errcode='22023'; end if;
 if not app_private.all_care_access(p_pet_ids,auth.uid()) then raise exception 'memory_access_denied' using errcode='42501'; end if;
 if not app_private.same_memory_audience(p_pet_ids) then raise exception 'memory_audience_mismatch' using errcode='23514'; end if;
end; $$;
create or replace function app_private.memory_result(p_memory_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('memory_id',m.id,'status',m.status,'revision',m.revision,'draft_expires_at',m.draft_expires_at,
 'media',coalesce((select jsonb_agg(jsonb_build_object('id',mm.id,'bucket_id','memory-media','storage_path',mm.storage_path,
 'content_type',mm.content_type,'byte_size',mm.byte_size,'position',mm.position) order by mm.position) from public.memory_media mm where mm.memory_id=m.id),'[]'::jsonb))
 from public.memories m where m.id=p_memory_id;
$$;
create or replace function app_private.lock_photo_day(p_pet_id uuid,p_date date)
returns void language sql volatile set search_path='' as $$
 select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_pet_id::text||':'||p_date::text,0));
$$;
create or replace function app_private.daily_photo_count(p_pet_id uuid,p_date date,p_exclude_memory uuid default null,p_exclude_asset uuid default null)
returns bigint language sql volatile security definer set search_path='' as $$
 select (select count(*) from public.media_assets a join public.diary_entries d on d.id=a.diary_entry_id
 where a.pet_id=p_pet_id and d.entry_date=p_date and (p_exclude_asset is null or a.id<>p_exclude_asset))+
 (select count(*) from public.memory_media mm join public.memories m on m.id=mm.memory_id
 join public.memory_pets mp on mp.memory_id=m.id and mp.pet_id=p_pet_id
 where m.status='published' and m.entry_date=p_date and (p_exclude_memory is null or m.id<>p_exclude_memory));
$$;
create or replace function app_private.assert_memory_photo_limit(p_pet_ids uuid[],p_date date,p_count integer,p_exclude_memory uuid)
returns void language plpgsql security definer set search_path='' as $$
declare pet uuid;
begin
 for pet in select id from unnest(p_pet_ids) t(id) order by id loop
 perform app_private.lock_photo_day(pet,p_date);
 if app_private.daily_photo_count(pet,p_date,p_exclude_memory)+p_count>5 then
 raise exception 'memory_photo_limit_reached' using errcode='23514'; end if;
 end loop;
end; $$;

create or replace function app_private.prepare_memory(p_client_mutation_id uuid,p_content text,p_entry_date date,p_occurred_at timestamptz,p_pet_ids uuid[],p_media jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); key bytea; hash bytea; receipt app_private.memory_mutation_receipts;
 mid uuid:=gen_random_uuid(); item jsonb; limits app_private.memory_limits; sorted_pets uuid[];
begin
 perform app_private.lock_pet_resource_writes();
 select * into limits from app_private.memory_limits;
 if actor is null then raise exception 'memory_access_denied' using errcode='42501'; end if;
 key:=app_private.requester_key(actor);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('memory-budget:'||encode(key,'hex'),0));
 select array_agg(id order by id) into sorted_pets from unnest(p_pet_ids) t(id);
 perform app_private.lock_memory_pets(sorted_pets);
 perform app_private.assert_memory_account(sorted_pets);
 perform app_private.validate_memory_input(p_content,p_entry_date,p_occurred_at,sorted_pets);
 if p_client_mutation_id is null or p_media is null or jsonb_typeof(p_media)<>'array' then raise exception 'memory_invalid_media' using errcode='22023'; end if;
 hash:=extensions.digest(jsonb_build_object('content',p_content,'date',p_entry_date,'at',p_occurred_at,'pets',sorted_pets,
 'media',(select coalesce(jsonb_agg(v order by (v->>'position')::int),'[]'::jsonb) from jsonb_array_elements(p_media) v))::text,'sha256');
 select * into receipt from app_private.memory_mutation_receipts where requester_key=key and client_mutation_id=p_client_mutation_id;
 if found then
 if receipt.payload_hash<>hash then raise exception 'memory_mutation_conflict' using errcode='23505'; end if;
 if receipt.deleted then raise exception 'memory_deleted' using errcode='55000'; end if;
 if not app_private.can_read_memory(receipt.memory_id) then raise exception 'memory_access_denied' using errcode='42501'; end if;
 return app_private.memory_result(receipt.memory_id);
 end if;
 if jsonb_array_length(p_media)>limits.max_photos or (btrim(p_content)='' and jsonb_array_length(p_media)=0) then raise exception 'memory_invalid_media' using errcode='22023'; end if;
 if (select count(*) from public.memories where created_by=actor and status='draft')>=limits.max_drafts then raise exception 'memory_draft_budget_exceeded' using errcode='23514'; end if;
 insert into public.memories(id,created_by,content,entry_date,occurred_at,client_mutation_id,draft_expires_at)
 values(mid,actor,p_content,p_entry_date,p_occurred_at,p_client_mutation_id,now()+limits.draft_ttl);
 insert into public.memory_pets select mid,id from unnest(sorted_pets) t(id);
 for item in select value from jsonb_array_elements(p_media) loop
 if (item->>'asset_id') is null or (item->>'content_type') is null or not((item->>'content_type')=any(limits.mime_types))
 or coalesce((item->>'byte_size')::bigint,0)<=0 or (item->>'byte_size')::bigint>limits.max_file_bytes
 or coalesce((item->>'position')::int,-1)<0 or (item->>'position')::int>=jsonb_array_length(p_media) then
 raise exception 'memory_invalid_media' using errcode='22023'; end if;
 insert into public.memory_media(id,memory_id,storage_path,content_type,byte_size,position,client_mutation_id)
 values((item->>'asset_id')::uuid,mid,mid::text||'/'||p_client_mutation_id::text||'/'||(item->>'asset_id')::uuid::text,
 item->>'content_type',(item->>'byte_size')::bigint,(item->>'position')::integer,p_client_mutation_id);
 end loop;
 insert into app_private.memory_mutation_receipts values(key,p_client_mutation_id,mid,hash,false);
 return app_private.memory_result(mid);
 exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'memory_invalid_media' using errcode='22023';
 when unique_violation then
 if sqlerrm='memory_mutation_conflict' then raise; end if;
 raise exception 'memory_invalid_media' using errcode='22023';
end; $$;

-- Lock pet rows before the parent; membership helpers are VOLATILE to refresh after waiting.
create or replace function app_private.lock_memory(p_memory_id uuid,p_new_pets uuid[] default '{}')
returns public.memories language plpgsql security definer set search_path='' as $$
declare old_pets uuid[]; locked_pets uuid[]; target public.memories;
begin
 perform app_private.lock_pet_resource_writes();
 old_pets:=app_private.memory_pet_ids(p_memory_id);
 select array_agg(distinct id order by id) into locked_pets from unnest(old_pets||p_new_pets) t(id);
 perform app_private.lock_memory_pets(locked_pets);
 select * into target from public.memories where id=p_memory_id for update;
 if not found then raise exception 'memory_not_found' using errcode='P0002'; end if;
 if old_pets<>app_private.memory_pet_ids(p_memory_id) then raise exception 'memory_tags_changed_retry' using errcode='40001'; end if;
 perform app_private.assert_memory_account(locked_pets);
 return target;
end; $$;
create or replace function app_private.publish_memory(p_memory_id uuid,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.memories; pets uuid[]; count_media integer; limits app_private.memory_limits;
begin
 target:=app_private.lock_memory(p_memory_id);
 pets:=app_private.memory_pet_ids(p_memory_id);
 if target.created_by is distinct from auth.uid() or not app_private.all_care_access(pets,auth.uid()) then raise exception 'memory_access_denied' using errcode='42501'; end if;
 if not app_private.same_memory_audience(pets) then raise exception 'memory_audience_mismatch' using errcode='23514'; end if;
 if target.status='published' and target.revision=p_expected_revision+1 then return app_private.memory_result(p_memory_id); end if;
 if target.revision is distinct from p_expected_revision then raise exception 'memory_revision_conflict' using errcode='40001'; end if;
 if target.status<>'draft' then raise exception 'memory_revision_conflict' using errcode='40001'; end if;
 if target.draft_expires_at<=now() then raise exception 'memory_draft_expired' using errcode='55000'; end if;
 select * into limits from app_private.memory_limits;
 if exists(select 1 from public.memory_media mm where mm.memory_id=p_memory_id and (mm.byte_size>limits.max_file_bytes or not(mm.content_type=any(limits.mime_types))
 or exists(select 1 from app_private.resource_cleanup_jobs q where q.bucket_id='memory-media' and q.storage_path=mm.storage_path)
 or not exists(
 select 1 from storage.objects o where o.bucket_id='memory-media' and o.name=mm.storage_path and o.owner_id=auth.uid()::text
 and o.metadata->>'mimetype'=mm.content_type and (o.metadata->>'size')::bigint=mm.byte_size))) then raise exception 'memory_invalid_media' using errcode='22023'; end if;
 select count(*) into count_media from public.memory_media where memory_id=p_memory_id;
 if count_media>limits.max_photos then raise exception 'memory_invalid_media' using errcode='22023'; end if;
 perform app_private.assert_memory_photo_limit(pets,target.entry_date,count_media,p_memory_id);
 update public.memory_media set cleanup_status='referenced' where memory_id=p_memory_id;
 update public.memories set status='published',revision=revision+1,updated_at=now() where id=p_memory_id;
 return app_private.memory_result(p_memory_id);
end; $$;
create or replace function app_private.update_memory(p_memory_id uuid,p_expected_revision integer,p_content text,p_entry_date date,p_occurred_at timestamptz,p_pet_ids uuid[],p_keep_media_ids uuid[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.memories; old_pets uuid[]; n integer;
begin
 target:=app_private.lock_memory(p_memory_id,p_pet_ids); old_pets:=app_private.memory_pet_ids(p_memory_id);
 if not ((coalesce(target.created_by=auth.uid(),false) and app_private.all_care_access(old_pets,auth.uid())) or app_private.all_pet_owner(old_pets,auth.uid())) then raise exception 'memory_access_denied' using errcode='42501'; end if;
 if target.revision is distinct from p_expected_revision then raise exception 'memory_revision_conflict' using errcode='40001'; end if;
 perform app_private.validate_memory_input(p_content,p_entry_date,p_occurred_at,p_pet_ids);
 if target.status='draft' and target.draft_expires_at<=now() then raise exception 'memory_draft_expired' using errcode='55000'; end if;
 if p_keep_media_ids is null or cardinality(p_keep_media_ids)<>(select count(distinct id) from unnest(p_keep_media_ids) t(id))
 or exists(select 1 from unnest(p_keep_media_ids) t(id) where not exists(select 1 from public.memory_media mm where mm.memory_id=p_memory_id and mm.id=t.id)) then raise exception 'memory_invalid_media' using errcode='22023'; end if;
 n:=cardinality(p_keep_media_ids);
 if n=0 and btrim(p_content)='' then raise exception 'memory_invalid_input' using errcode='22023'; end if;
 if target.status='published' then perform app_private.assert_memory_photo_limit(p_pet_ids,p_entry_date,n,p_memory_id); end if;
 delete from public.memory_media where memory_id=p_memory_id and not(id=any(p_keep_media_ids));
 delete from public.memory_pets where memory_id=p_memory_id;
 insert into public.memory_pets select p_memory_id,id from unnest(p_pet_ids) t(id);
 update public.memories set content=p_content,entry_date=p_entry_date,occurred_at=p_occurred_at,revision=revision+1,updated_at=now() where id=p_memory_id;
 if target.status='draft' and target.created_by is distinct from auth.uid() then
 return jsonb_build_object('memory_id',p_memory_id,'status','draft','revision',target.revision+1); end if;
 return app_private.memory_result(p_memory_id);
end; $$;
create or replace function app_private.delete_memory(p_memory_id uuid,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.memories; pets uuid[];
begin
 if exists(select 1 from app_private.memory_mutation_receipts r where r.memory_id=p_memory_id and r.requester_key=app_private.requester_key(auth.uid()) and r.deleted) then
 return jsonb_build_object('memory_id',p_memory_id,'deleted',true); end if;
 target:=app_private.lock_memory(p_memory_id); pets:=app_private.memory_pet_ids(p_memory_id);
 if not ((coalesce(target.created_by=auth.uid(),false) and app_private.all_care_access(pets,auth.uid())) or app_private.all_pet_owner(pets,auth.uid())) then raise exception 'memory_access_denied' using errcode='42501'; end if;
 if target.revision is distinct from p_expected_revision then raise exception 'memory_revision_conflict' using errcode='40001'; end if;
 delete from public.memories where id=p_memory_id;
 return jsonb_build_object('memory_id',p_memory_id,'deleted',true);
end; $$;
create or replace function app_private.prepare_pet_avatar_job(p_pet_id uuid,p_client_mutation_id uuid,p_source_asset_id uuid,p_source_content_type text,p_source_byte_size bigint,p_consent_version text,p_policy_version text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); key bytea; hash bytea; receipt app_private.avatar_mutation_receipts; job public.pet_avatar_jobs; limits app_private.memory_limits;
begin
 perform app_private.lock_pet_resource_writes();
 if actor is null then raise exception 'avatar_owner_required' using errcode='42501'; end if;
 key:=app_private.requester_key(actor);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('avatar-mutation:'||encode(key,'hex')||':'||p_client_mutation_id::text,0));
 perform app_private.lock_memory_pets(array[p_pet_id]);
 perform app_private.assert_memory_account(array[p_pet_id]);
 if not app_private.all_pet_owner(array[p_pet_id],actor) then raise exception 'avatar_owner_required' using errcode='42501'; end if;
 select * into limits from app_private.memory_limits;
 if p_client_mutation_id is null or p_source_asset_id is null or p_source_content_type is null or not(p_source_content_type=any(limits.mime_types))
 or p_source_byte_size is null or p_source_byte_size<=0 or p_source_byte_size>limits.max_file_bytes
 or nullif(btrim(p_consent_version),'') is null or nullif(btrim(p_policy_version),'') is null then raise exception 'avatar_invalid_input' using errcode='22023'; end if;
 hash:=extensions.digest(jsonb_build_array(p_pet_id,p_source_asset_id,p_source_content_type,p_source_byte_size,p_consent_version,p_policy_version)::text,'sha256');
 select * into receipt from app_private.avatar_mutation_receipts where requester_key=key and client_mutation_id=p_client_mutation_id;
 if found then
 if receipt.deleted then raise exception 'avatar_deleted' using errcode='55000'; end if;
 if receipt.payload_hash<>hash then raise exception 'avatar_mutation_conflict' using errcode='23505'; end if;
 select * into job from public.pet_avatar_jobs where id=receipt.job_id;
 else
 job.id:=gen_random_uuid();
 insert into public.pet_avatar_jobs(id,pet_id,requester_id,client_mutation_id,source_path,source_content_type,source_byte_size,consent_version,policy_version)
 values(job.id,p_pet_id,actor,p_client_mutation_id,p_pet_id::text||'/'||job.id::text||'/'||p_source_asset_id::text,p_source_content_type,p_source_byte_size,p_consent_version,p_policy_version)
 returning * into job;
 insert into app_private.avatar_mutation_receipts values(key,p_client_mutation_id,job.id,hash,false);
 end if;
 return jsonb_build_object('job_id',job.id,'pet_id',job.pet_id,'status',job.status,'bucket_id','pet-avatars','source_path',job.source_path,'source_content_type',job.source_content_type,'source_byte_size',job.source_byte_size);
end; $$;
create or replace function app_private.apply_pet_avatar(p_pet_id uuid,p_avatar_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform app_private.lock_memory_pets(array[p_pet_id]);
 perform app_private.assert_memory_account(array[p_pet_id]);
 if not app_private.all_pet_owner(array[p_pet_id],auth.uid()) then raise exception 'avatar_owner_required' using errcode='42501'; end if;
 if not exists(select 1 from public.pet_avatars where id=p_avatar_id and pet_id=p_pet_id) then raise exception 'avatar_not_found' using errcode='P0002'; end if;
 if not exists(select 1 from public.pet_avatars a join public.pet_avatar_jobs j on j.id=a.job_id
 join storage.objects o on o.bucket_id='pet-avatars' and o.name=a.storage_path
 where a.id=p_avatar_id and a.pet_id=p_pet_id and a.validation_status='validated' and j.status='ready' and j.requester_id=auth.uid()
 and o.metadata->>'mimetype'=a.content_type and (o.metadata->>'size')::bigint=a.byte_size) then raise exception 'avatar_not_ready' using errcode='55000'; end if;
 update public.pet_avatars set is_applied=false where pet_id=p_pet_id and is_applied;
 update public.pet_avatars set is_applied=true where id=p_avatar_id;
 return jsonb_build_object('pet_id',p_pet_id,'avatar_id',p_avatar_id,'applied',true);
end; $$;
create or replace function app_private.guard_avatar_state()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then perform app_private.lock_memory_pets(array[new.pet_id]); end if;
 if exists(select 1 from app_private.account_deletion_jobs j join public.pets p on p.owner_id=j.user_id where p.id=new.pet_id) then
 raise exception 'account_deletion_in_progress' using errcode='55000'; end if;
 if tg_table_name='pet_avatars' then
 if not exists(select 1 from public.pet_avatar_jobs j join public.pets p on p.id=j.pet_id
 where j.id=new.job_id and j.pet_id=new.pet_id and j.status<>'cancelled' and j.requester_id=p.owner_id) then
 raise exception 'avatar_not_ready' using errcode='55000'; end if;
 end if;
 if tg_table_name='pet_avatar_jobs' and tg_op='UPDATE' then
 if old.status='cancelled' and new.status<>'cancelled' then
 raise exception 'avatar_deleted' using errcode='55000'; end if;
 end if;
 return new;
end; $$;
create trigger guard_avatar_job before insert or update on public.pet_avatar_jobs for each row execute function app_private.guard_avatar_state();
create trigger guard_avatar_asset before insert or update on public.pet_avatars for each row execute function app_private.guard_avatar_state();

create or replace function app_private.queue_resource_cleanup()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='memory_media' then
 insert into app_private.resource_cleanup_jobs(bucket_id,storage_path) values('memory-media',old.storage_path) on conflict do nothing;
 elsif tg_table_name='pet_avatar_jobs' then
 insert into app_private.resource_cleanup_jobs(bucket_id,storage_path) values('pet-avatars',old.source_path) on conflict do nothing;
 update app_private.avatar_mutation_receipts set deleted=true where job_id=old.id;
 elsif tg_table_name='pet_avatars' then
 insert into app_private.resource_cleanup_jobs(bucket_id,storage_path) values('pet-avatars',old.storage_path) on conflict do nothing;
 elsif tg_table_name='memories' then
 insert into app_private.resource_cleanup_jobs(bucket_id,storage_path) select 'memory-media',storage_path from public.memory_media where memory_id=old.id on conflict do nothing;
 update app_private.memory_mutation_receipts set deleted=true where memory_id=old.id;
 end if;
 return old;
end; $$;
create trigger memory_cleanup before delete on public.memories for each row execute function app_private.queue_resource_cleanup();
create trigger memory_media_cleanup before delete on public.memory_media for each row execute function app_private.queue_resource_cleanup();
create trigger avatar_job_cleanup before delete on public.pet_avatar_jobs for each row execute function app_private.queue_resource_cleanup();
create trigger avatar_cleanup before delete on public.pet_avatars for each row execute function app_private.queue_resource_cleanup();
create or replace function app_private.delete_pet_memory_resources()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform app_private.lock_pet_members_for_delete(old.id);
 -- Lock shared memories in one order even when two tagged pets are deleted concurrently.
 perform id from public.memories where id in(select memory_id from public.memory_pets where pet_id=old.id) order by id for update;
 -- Whole-memory deletion prevents a pet cascade from widening an audience.
 delete from public.memories where id in(select memory_id from public.memory_pets where pet_id=old.id);
 delete from public.pet_avatar_jobs where pet_id=old.id;
 return old;
end; $$;
create trigger delete_pet_memory_resources before delete on public.pets for each row execute function app_private.delete_pet_memory_resources();
create or replace function app_private.delete_account_memory_drafts()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from public.memories where created_by=old.id and status='draft';
 return old;
end; $$;
create trigger delete_account_memory_drafts before delete on auth.users for each row execute function app_private.delete_account_memory_drafts();

alter table public.memories enable row level security;
alter table public.memory_pets enable row level security;
alter table public.memory_media enable row level security;
alter table public.pet_avatar_jobs enable row level security;
alter table public.pet_avatars enable row level security;
revoke all on public.memories,public.memory_pets,public.memory_media,public.pet_avatar_jobs,public.pet_avatars from anon,authenticated;
grant select on public.memories to authenticated;
grant select on public.memory_pets to authenticated;
grant select on public.memory_media to authenticated;
grant select (id,pet_id,requester_id,client_mutation_id,source_path,source_content_type,source_byte_size,consent_version,policy_version,status,error_code,created_at,updated_at,completed_at) on public.pet_avatar_jobs to authenticated;
grant select on public.pet_avatars to authenticated;
grant all on public.memories,public.memory_pets,public.memory_media,public.pet_avatar_jobs,public.pet_avatars to service_role;
create policy "memories complete audience select" on public.memories for select to authenticated using(app_private.can_read_memory(id));
create policy "memory pets complete audience select" on public.memory_pets for select to authenticated using(app_private.can_read_memory(memory_id));
create policy "memory media complete audience select" on public.memory_media for select to authenticated using(app_private.can_read_memory(memory_id));
create policy "avatar requester select" on public.pet_avatar_jobs for select to authenticated using(requester_id=(select auth.uid()) and app_private.all_pet_owner(array[pet_id],(select auth.uid())));
create policy "avatar validated pet select" on public.pet_avatars for select to authenticated using(validation_status='validated' and app_private.is_pet_member(pet_id,(select auth.uid())));
-- No client write policy on these five tables, in addition to revoked DML grants.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
select bucket,bucket,false,l.max_file_bytes,l.mime_types from app_private.memory_limits l cross join unnest(array['pet-avatars','memory-media']) b(bucket);

create or replace function app_private.memory_storage_read(p_path text)
returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from public.memory_media mm where mm.storage_path=p_path and app_private.can_read_memory(mm.memory_id));
$$;
create or replace function app_private.avatar_storage_read(p_path text)
returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from public.pet_avatar_jobs j where j.source_path=p_path and j.requester_id=auth.uid() and app_private.all_pet_owner(array[j.pet_id],auth.uid()))
 or exists(select 1 from public.pet_avatars a where a.storage_path=p_path and a.validation_status='validated' and app_private.is_pet_member(a.pet_id,auth.uid()));
$$;
create or replace function app_private.resource_storage_insert(p_bucket text,p_path text,p_owner text,p_metadata jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare target public.memories; media public.memory_media; job public.pet_avatar_jobs; pets uuid[];
begin
 if p_owner is distinct from auth.uid()::text or auth.uid() is null then return false; end if;
 if exists(select 1 from app_private.resource_cleanup_jobs where bucket_id=p_bucket and storage_path=p_path) then return false; end if;
 if p_bucket='memory-media' then
 select * into media from public.memory_media where storage_path=p_path;
 if not found then return false; end if;
 select * into target from public.memories where id=media.memory_id;
 if not found then return false; end if;
 pets:=app_private.memory_pet_ids(target.id);
 perform app_private.assert_memory_account(pets);
 return target.status='draft' and target.created_by=auth.uid() and target.draft_expires_at>now()
 and app_private.all_care_access(pets,auth.uid()) and app_private.same_memory_audience(pets)
 and p_metadata->>'mimetype'=media.content_type;
 elsif p_bucket='pet-avatars' then
 select * into job from public.pet_avatar_jobs where source_path=p_path;
 if not found then return false; end if;
 perform app_private.assert_memory_account(array[job.pet_id]);
 return job.status='queued' and job.requester_id=auth.uid() and app_private.all_pet_owner(array[job.pet_id],auth.uid())
 and p_metadata->>'mimetype'=job.source_content_type;
 end if;
 return false;
 exception when sqlstate 'P0002' or sqlstate '55000' or sqlstate '42501' or invalid_text_representation then return false;
end; $$;
create policy "memory media relational read" on storage.objects for select to authenticated using(bucket_id='memory-media' and app_private.memory_storage_read(name));
create policy "memory media reserved insert" on storage.objects for insert to authenticated with check(bucket_id='memory-media' and app_private.resource_storage_insert(bucket_id,name,owner_id,metadata));
create policy "pet avatars relational read" on storage.objects for select to authenticated using(bucket_id='pet-avatars' and app_private.avatar_storage_read(name));
create policy "pet avatars reserved source insert" on storage.objects for insert to authenticated with check(bucket_id='pet-avatars' and app_private.resource_storage_insert(bucket_id,name,owner_id,metadata));

create or replace function public.list_pending_resource_cleanup_v1(p_limit integer default 100)
returns table(bucket_id text,storage_path text) language sql security definer set search_path='' as $$
 update app_private.resource_cleanup_jobs set attempts=attempts+1,updated_at=now() where (resource_cleanup_jobs.bucket_id,resource_cleanup_jobs.storage_path) in
 (select j.bucket_id,j.storage_path from app_private.resource_cleanup_jobs j order by j.updated_at,j.bucket_id,j.storage_path limit greatest(1,least(coalesce(p_limit,100),1000)))
 returning resource_cleanup_jobs.bucket_id,resource_cleanup_jobs.storage_path;
$$;
create or replace function public.complete_resource_cleanup_v1(p_bucket_id text,p_storage_path text)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform app_private.lock_pet_resource_writes();
 if exists(select 1 from storage.objects where bucket_id=p_bucket_id and name=p_storage_path) then raise exception 'resource_cleanup_incomplete' using errcode='55000'; end if;
 delete from app_private.resource_cleanup_jobs where bucket_id=p_bucket_id and storage_path=p_storage_path;
end; $$;
create or replace function public.expire_memory_drafts_v1(p_limit integer default 100)
returns integer language plpgsql security definer set search_path='' as $$
declare target uuid; targets uuid[]; pets uuid[]; n integer:=0;
begin
 perform app_private.lock_pet_resource_writes();
 select array_agg(id order by id) into targets from (select id from public.memories where status='draft' and draft_expires_at<=now() order by draft_expires_at,id limit greatest(1,least(coalesce(p_limit,100),1000))) candidates;
 select array_agg(distinct pet_id order by pet_id) into pets from public.memory_pets where memory_id=any(targets);
 perform app_private.lock_memory_pets(pets);
 for target in select id from public.memories where id=any(targets) order by id loop
 delete from public.memories where id=target and status='draft' and draft_expires_at<=now();
 if found then n:=n+1; end if;
 end loop;
 return n;
end; $$;
-- Extend the durable account worker without changing deployed v1 RPC signatures.
alter table app_private.account_deletion_media_rehomes add column bucket_id text not null default 'pet-media';
alter table app_private.account_deletion_media_rehomes add column resource_kind text not null default 'legacy';
create or replace function public.list_account_deletion_memory_objects_v2(p_user_id uuid,p_limit integer default 100)
returns table(bucket_id text,name text,media_asset_id uuid) language sql stable security definer set search_path='' as $$
 select 'memory-media'::text,o.name,mm.id from storage.objects o join public.memory_media mm on mm.storage_path=o.name
 join public.memories m on m.id=mm.memory_id
 where o.bucket_id='memory-media' and o.owner_id=p_user_id::text and m.status='published'
 order by o.name limit greatest(1,least(coalesce(p_limit,100),1000));
$$;
-- Intent precedes Storage.copy, so its superuser completion can prove a live reservation.
create or replace function public.prepare_account_deletion_memory_rehome_v2(p_user_id uuid,p_media_asset_id uuid,p_source_path text,p_destination_path text)
returns void language plpgsql security definer set search_path='' as $$
declare pets uuid[]; media public.memory_media; target public.memories; job app_private.account_deletion_jobs; r app_private.account_deletion_media_rehomes;
begin
 perform app_private.lock_pet_resource_writes();
 select * into media from public.memory_media where id=p_media_asset_id;
 if not found then raise exception 'memory_not_found' using errcode='P0002'; end if;
 pets:=app_private.memory_pet_ids(media.memory_id);
 perform app_private.lock_memory_pets(pets);
 select * into target from public.memories where id=media.memory_id for update;
 if target.id is not null and pets<>app_private.memory_pet_ids(target.id) then raise exception 'memory_tags_changed_retry' using errcode='40001'; end if;
 select * into media from public.memory_media where id=p_media_asset_id for update;
 if not found or target.id is null or target.status<>'published' then raise exception 'memory_not_found' using errcode='P0002'; end if;
 select * into job from app_private.account_deletion_jobs where user_id=p_user_id and status='preparing';
 if not found then raise exception 'account_deletion_in_progress' using errcode='55000'; end if;
 if p_destination_path is null or p_destination_path !~ ('^'||media.memory_id::text||'/'||job.job_id::text||'/[0-9a-f-]{36}$') or p_source_path=p_destination_path then
 raise exception 'memory_invalid_media' using errcode='22023'; end if;
 select * into r from app_private.account_deletion_media_rehomes where user_id=p_user_id and media_asset_id=p_media_asset_id for update;
 if found then
 if r.resource_kind<>'memory' or r.source_path<>p_source_path or r.destination_path<>p_destination_path then raise exception 'memory_rehome_conflict' using errcode='23505'; end if;
 if media.storage_path not in(r.source_path,r.destination_path) then raise exception 'memory_rehome_conflict' using errcode='40001'; end if;
 return;
 end if;
 if media.storage_path<>p_source_path or not exists(select 1 from storage.objects where bucket_id='memory-media' and name=p_source_path and owner_id=p_user_id::text) then
 raise exception 'memory_invalid_media' using errcode='22023'; end if;
 insert into app_private.account_deletion_media_rehomes(user_id,media_asset_id,source_path,destination_path,bucket_id,resource_kind)
 values(p_user_id,p_media_asset_id,p_source_path,p_destination_path,'memory-media','memory');
end; $$;
create or replace function public.rehome_account_deletion_memory_v2(p_user_id uuid,p_media_asset_id uuid,p_source_path text,p_destination_path text)
returns void language plpgsql security definer set search_path='' as $$
declare pets uuid[]; media public.memory_media; target public.memories; r app_private.account_deletion_media_rehomes;
begin
 perform app_private.lock_pet_resource_writes();
 select * into media from public.memory_media where id=p_media_asset_id;
 if not found then raise exception 'memory_not_found' using errcode='P0002'; end if;
 pets:=app_private.memory_pet_ids(media.memory_id);
 perform app_private.lock_memory_pets(pets);
 select * into target from public.memories where id=media.memory_id for update;
 if target.id is not null and pets<>app_private.memory_pet_ids(target.id) then raise exception 'memory_tags_changed_retry' using errcode='40001'; end if;
 select * into media from public.memory_media where id=p_media_asset_id for update;
 if not found or target.id is null then raise exception 'memory_not_found' using errcode='P0002'; end if;
 select * into r from app_private.account_deletion_media_rehomes where user_id=p_user_id and media_asset_id=p_media_asset_id and resource_kind='memory' for update;
 if not found or r.source_path is distinct from p_source_path or r.destination_path is distinct from p_destination_path
 or media.storage_path not in(p_source_path,p_destination_path)
 or not exists(select 1 from app_private.account_deletion_jobs where user_id=p_user_id and status='preparing') then
 raise exception 'memory_rehome_conflict' using errcode='40001'; end if;
 if not exists(select 1 from storage.objects where bucket_id='memory-media' and name=p_destination_path and owner_id is null
 and metadata->>'mimetype'=media.content_type and metadata->>'size' ~ '^[0-9]+$' and (metadata->>'size')::numeric=media.byte_size) then
 raise exception 'memory_invalid_media' using errcode='22023'; end if;
 update public.memory_media set storage_path=p_destination_path where id=p_media_asset_id;
end; $$;
create or replace function public.list_account_deletion_memory_rehomes_v2(p_user_id uuid)
returns table(media_asset_id uuid,source_path text,destination_path text) language sql stable security definer set search_path='' as $$
 select media_asset_id,source_path,destination_path from app_private.account_deletion_media_rehomes where user_id=p_user_id and resource_kind='memory' order by created_at,media_asset_id;
$$;
create or replace function public.rollback_account_deletion_memory_v2(p_user_id uuid,p_media_asset_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare pets uuid[]; r app_private.account_deletion_media_rehomes; media public.memory_media; target public.memories;
begin
 perform app_private.lock_pet_resource_writes();
 if not exists(select 1 from auth.users where id=p_user_id) or not exists(select 1 from app_private.account_deletion_jobs where user_id=p_user_id and status='preparing') then
 raise exception 'account_deletion_in_progress' using errcode='55000'; end if;
 select * into media from public.memory_media where id=p_media_asset_id;
 if found then
 pets:=app_private.memory_pet_ids(media.memory_id);
 perform app_private.lock_memory_pets(pets);
 select * into target from public.memories where id=media.memory_id for update;
 if target.id is not null and pets<>app_private.memory_pet_ids(target.id) then raise exception 'memory_tags_changed_retry' using errcode='40001'; end if;
 select * into media from public.memory_media where id=p_media_asset_id for update;
 end if;
 select * into r from app_private.account_deletion_media_rehomes where user_id=p_user_id and media_asset_id=p_media_asset_id and resource_kind='memory' for update;
 if not found then return null; end if;
 if media.id is not null and target.id is not null then
 if not exists(select 1 from storage.objects where bucket_id='memory-media' and name=r.source_path) then raise exception 'memory_invalid_media' using errcode='22023'; end if;
 update public.memory_media set storage_path=r.source_path where id=p_media_asset_id and storage_path=r.destination_path;
 if exists(select 1 from public.memory_media where storage_path=r.destination_path) then raise exception 'memory_rehome_conflict' using errcode='40001'; end if;
 end if;
 delete from app_private.account_deletion_media_rehomes where user_id=p_user_id and media_asset_id=p_media_asset_id;
 return r.destination_path;
end; $$;
-- Keep old v1 inventories restricted to legacy mappings; the v2 adapter drains memory first.
create or replace function public.list_account_deletion_rehomes_v1(p_user_id uuid)
returns table(media_asset_id uuid,source_path text,destination_path text) language sql stable security definer set search_path='' as $$
 select media_asset_id,source_path,destination_path from app_private.account_deletion_media_rehomes where user_id=p_user_id and resource_kind='legacy' order by created_at,media_asset_id;
$$;
create or replace function public.list_account_deletion_temporary_objects_v1(p_user_id uuid)
returns table(bucket_id text,name text) language sql stable security definer set search_path='' as $$
 select o.bucket_id,o.name from app_private.account_deletion_jobs j join storage.objects o on
 (o.bucket_id='pet-media' and o.name like '%/.account-deletion/'||j.job_id::text||'/%')
 or (o.bucket_id='memory-media' and split_part(o.name,'/',2)=j.job_id::text)
 where j.user_id=p_user_id
 and not exists(select 1 from public.media_assets a where o.bucket_id='pet-media' and a.storage_path=o.name)
 and not exists(select 1 from public.memory_media mm where o.bucket_id='memory-media' and mm.storage_path=o.name)
 order by o.bucket_id,o.name;
$$;
create or replace function public.account_deletion_storage_state_v1(p_user_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'registered_user_owned_count',(select count(*) from storage.objects o where o.owner_id=p_user_id::text and (
 exists(select 1 from public.media_assets a where o.bucket_id='pet-media' and a.storage_path=o.name)
 or exists(select 1 from public.memory_media mm join public.memories m on m.id=mm.memory_id where o.bucket_id='memory-media' and mm.storage_path=o.name and m.status='published'))),
 'user_owned_count',(select count(*) from storage.objects where owner_id=p_user_id::text),
 'owned_pet_object_count',(select count(*) from storage.objects o where o.bucket_id in('pet-media','pet-avatars') and exists(
 select 1 from app_private.account_deletion_jobs j,unnest(j.owned_pet_ids) p(id) where j.user_id=p_user_id and split_part(o.name,'/',1)=p.id::text)),
 'temporary_object_count',(select count(*) from public.list_account_deletion_temporary_objects_v1(p_user_id)));
$$;

create or replace function app_private.create_photo_diary_entry(
  p_entry_id uuid,
  p_pet_id uuid,
  p_entry_date date,
  p_occurred_at timestamptz,
  p_summary text,
  p_client_mutation_id uuid,
  p_media jsonb
)
returns public.diary_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_actor_user_id uuid := (select auth.uid());
  can_manage_any_date boolean;
  can_add_today boolean;
  existing_entry public.diary_entries;
  created_entry public.diary_entries;
  media_item jsonb;
  media_path text;
  media_content_type text;
  media_paths text[] := array[]::text[];
begin
  perform app_private.lock_memory_pets(array[p_pet_id]);
  if current_actor_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  can_manage_any_date := app_private.has_pet_role(
    p_pet_id,
    current_actor_user_id,
    array['owner','caregiver']::public.pet_member_role[]
  );
  can_add_today := app_private.has_pet_role(
    p_pet_id,
    current_actor_user_id,
    array['pet_sitter']::public.pet_member_role[]
  ) and app_private.matches_local_entry_date(pg_catalog.now(), p_entry_date);
  if not can_manage_any_date and not can_add_today then
    raise exception 'Only the pet care team can save diary photos.' using errcode = '42501';
  end if;

  if p_entry_id is null or p_client_mutation_id is null or p_entry_date is null or p_occurred_at is null then
    raise exception 'Photo diary identifiers and time are required.' using errcode = '22023';
  end if;
  if not app_private.matches_local_entry_date(p_occurred_at, p_entry_date) then
    raise exception 'Photo diary date and time do not match.' using errcode = '22023';
  end if;
  if p_media is null or jsonb_typeof(p_media) <> 'array' or jsonb_array_length(p_media) < 1 or jsonb_array_length(p_media) > 5 then
    raise exception 'Photo diary entries require between one and five photos.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_summary, '')) > 2000 then
    raise exception 'Photo diary summary is too long.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('photo-diary:' || p_pet_id::text || ':' || p_client_mutation_id::text, 0)
  );

  select de.* into existing_entry
  from public.diary_entries de
  where de.pet_id = p_pet_id and de.client_mutation_id = p_client_mutation_id;
  if found then
    if existing_entry.id <> p_entry_id
      or existing_entry.category <> 'photo'
      or existing_entry.created_by <> current_actor_user_id then
      raise exception 'Photo diary mutation id conflicts with another record.' using errcode = '22023';
    end if;
    return existing_entry;
  end if;

  for media_item in select value from jsonb_array_elements(p_media)
  loop
    media_path := nullif(media_item ->> 'storage_path', '');
    media_content_type := nullif(media_item ->> 'content_type', '');
    if media_path is null
      or media_path not like p_pet_id::text || '/diary/' || p_entry_id::text || '/%'
      or media_content_type not in ('image/jpeg', 'image/png', 'image/webp') then
      raise exception 'Invalid photo diary media metadata.' using errcode = '22023';
    end if;
    if media_path = any(media_paths) then
      raise exception 'Duplicate photo diary storage path.' using errcode = '22023';
    end if;
    if not exists (
      select 1 from storage.objects so
      where so.bucket_id = 'pet-media'
        and so.name = media_path
        and so.owner_id = current_actor_user_id::text
    ) then
      raise exception 'Uploaded photo object was not found for this user.' using errcode = '22023';
    end if;
    media_paths := array_append(media_paths, media_path);
  end loop;

  insert into public.diary_entries (
    id, pet_id, created_by, category, entry_date, occurred_at,
    summary, condition_score, client_mutation_id, record_origin
  ) values (
    p_entry_id, p_pet_id, current_actor_user_id, 'photo', p_entry_date, p_occurred_at,
    coalesce(p_summary, ''), null, p_client_mutation_id, 'diary'
  ) returning * into created_entry;

  for media_item in select value from jsonb_array_elements(p_media)
  loop
    insert into public.media_assets (
      pet_id, diary_entry_id, storage_path, content_type, created_by
    ) values (
      p_pet_id,
      created_entry.id,
      media_item ->> 'storage_path',
      media_item ->> 'content_type',
      current_actor_user_id
    );
  end loop;

  return created_entry;
end;
$$;

-- Photo diary append: body identical to 20260714021421 except the date check
-- now uses the device-local window.
create or replace function app_private.update_photo_diary_entry(
  p_entry_id uuid,
  p_pet_id uuid,
  p_occurred_at timestamptz,
  p_append_mutation_id uuid,
  p_media jsonb
)
returns public.diary_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  target_entry public.diary_entries;
  media_item jsonb;
  media_path text;
  media_content_type text;
  existing_entry_id uuid;
  existing_content_type text;
  media_paths text[] := array[]::text[];
  daily_photo_count integer;
  new_photo_count integer := 0;
begin
  perform app_private.lock_memory_pets(array[p_pet_id]);
  if actor_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if not app_private.has_pet_role(
    p_pet_id,
    actor_user_id,
    array['owner','caregiver']::public.pet_member_role[]
  ) then
    raise exception 'Only the pet owner or caregiver can update diary photos.' using errcode = '42501';
  end if;
  if p_entry_id is null or p_pet_id is null or p_occurred_at is null or p_append_mutation_id is null then
    raise exception 'Photo diary update identifiers and time are required.' using errcode = '22023';
  end if;
  if p_media is null or jsonb_typeof(p_media) <> 'array' or jsonb_array_length(p_media) > 5 then
    raise exception 'Photo diary updates accept up to five appended photos.' using errcode = '22023';
  end if;

  select entry.* into target_entry
  from public.diary_entries as entry
  where entry.id = p_entry_id and entry.pet_id = p_pet_id
  for update;
  if not found then
    raise exception 'Photo diary entry was not found.' using errcode = 'P0002';
  end if;
  if target_entry.category <> 'photo' then
    raise exception 'Only photo diary entries can append photos.' using errcode = '22023';
  end if;
  if not app_private.matches_local_entry_date(p_occurred_at, target_entry.entry_date) then
    raise exception 'Photo diary date and time do not match.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('photo-diary-update:' || p_entry_id::text || ':' || p_append_mutation_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_pet_id::text || ':' || target_entry.entry_date::text, 0)
  );

  daily_photo_count := app_private.daily_photo_count(p_pet_id,target_entry.entry_date);

  for media_item in select value from jsonb_array_elements(p_media)
  loop
    media_path := nullif(media_item ->> 'storage_path', '');
    media_content_type := nullif(media_item ->> 'content_type', '');
    if media_path is null
      or media_path not like p_pet_id::text || '/diary/' || p_entry_id::text || '/' || p_append_mutation_id::text || '-%'
      or media_content_type not in ('image/jpeg', 'image/png', 'image/webp') then
      raise exception 'Invalid appended photo metadata.' using errcode = '22023';
    end if;
    if media_path = any(media_paths) then
      raise exception 'Duplicate appended photo path.' using errcode = '22023';
    end if;
    media_paths := array_append(media_paths, media_path);

    existing_entry_id := null;
    existing_content_type := null;
    select asset.diary_entry_id, asset.content_type
      into existing_entry_id, existing_content_type
    from public.media_assets as asset
    where asset.storage_path = media_path;
    if found then
      if existing_entry_id <> p_entry_id or existing_content_type <> media_content_type then
        raise exception 'Appended photo path conflicts with another media record.' using errcode = '22023';
      end if;
      continue;
    end if;

    if not exists (
      select 1 from storage.objects as object
      where object.bucket_id = 'pet-media'
        and object.name = media_path
        and object.owner_id = actor_user_id::text
    ) then
      raise exception 'Uploaded appended photo was not found for this user.' using errcode = '22023';
    end if;
    new_photo_count := new_photo_count + 1;
  end loop;

  if daily_photo_count + new_photo_count > 5 then
    raise exception 'Daily diary photo limit is 5.' using errcode = '23514';
  end if;

  update public.diary_entries as entry
  set occurred_at = p_occurred_at, updated_at = now(), record_origin = 'diary'
  where entry.id = p_entry_id
  returning entry.* into target_entry;

  for media_item in select value from jsonb_array_elements(p_media)
  loop
    media_path := media_item ->> 'storage_path';
    if not exists (
      select 1 from public.media_assets as asset
      where asset.storage_path = media_path
    ) then
      insert into public.media_assets (
        pet_id, diary_entry_id, storage_path, content_type, created_by
      ) values (
        p_pet_id,
        p_entry_id,
        media_path,
        media_item ->> 'content_type',
        actor_user_id
      );
    end if;
  end loop;

  return target_entry;
end;
$$;


create or replace function app_private.enforce_daily_diary_photo_limit()
returns trigger language plpgsql security definer set search_path='' as $$
declare d date;
begin
 perform app_private.lock_memory_pets(array[new.pet_id]);
 if new.diary_entry_id is null then return new; end if;
 perform id from public.diary_entries where id=new.diary_entry_id and pet_id=new.pet_id for share;
 select entry_date into d from public.diary_entries where id=new.diary_entry_id and pet_id=new.pet_id;
 if d is null then raise exception 'Diary photo must belong to the same pet diary entry' using errcode='23514'; end if;
 perform app_private.lock_photo_day(new.pet_id,d);
 if app_private.daily_photo_count(new.pet_id,d,null,case when tg_op='UPDATE' then old.id else null end)>=5 then
 raise exception 'Daily diary photo limit is 5.' using errcode='23514'; end if;
 return new;
end; $$;
drop trigger enforce_daily_diary_photo_limit on public.media_assets;
create trigger enforce_daily_diary_photo_limit before insert or update of pet_id,diary_entry_id on public.media_assets for each row execute function app_private.enforce_daily_diary_photo_limit();
create or replace function app_private.guard_legacy_photo_date_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if old.entry_date is distinct from new.entry_date or old.pet_id is distinct from new.pet_id then
 select count(*) into n from public.media_assets where diary_entry_id=old.id;
 if n>0 then
 if new.pet_id<>old.pet_id then raise exception 'Diary photo must belong to the same pet diary entry' using errcode='23514'; end if;
 perform app_private.lock_photo_day(new.pet_id,new.entry_date);
 if app_private.daily_photo_count(new.pet_id,new.entry_date)+n>5 then raise exception 'Daily diary photo limit is 5.' using errcode='23514'; end if;
 end if;
 end if;
 return new;
end; $$;
create trigger guard_legacy_photo_date_change before update of pet_id,entry_date on public.diary_entries for each row execute function app_private.guard_legacy_photo_date_change();

create or replace function public.prepare_memory(p_client_mutation_id uuid,p_content text,p_entry_date date,p_occurred_at timestamptz,p_pet_ids uuid[],p_media jsonb) returns jsonb language sql security invoker set search_path='' as $$ select app_private.prepare_memory(p_client_mutation_id,p_content,p_entry_date,p_occurred_at,p_pet_ids,p_media); $$;

create or replace function public.publish_memory(p_memory_id uuid,p_expected_revision integer) returns jsonb language sql security invoker set search_path='' as $$ select app_private.publish_memory(p_memory_id,p_expected_revision); $$;

create or replace function public.update_memory(p_memory_id uuid,p_expected_revision integer,p_content text,p_entry_date date,p_occurred_at timestamptz,p_pet_ids uuid[],p_keep_media_ids uuid[]) returns jsonb language sql security invoker set search_path='' as $$ select app_private.update_memory(p_memory_id,p_expected_revision,p_content,p_entry_date,p_occurred_at,p_pet_ids,p_keep_media_ids); $$;

create or replace function public.delete_memory(p_memory_id uuid,p_expected_revision integer) returns jsonb language sql security invoker set search_path='' as $$ select app_private.delete_memory(p_memory_id,p_expected_revision); $$;

create or replace function public.prepare_pet_avatar_job(p_pet_id uuid,p_client_mutation_id uuid,p_source_asset_id uuid,p_source_content_type text,p_source_byte_size bigint,p_consent_version text,p_policy_version text) returns jsonb language sql security invoker set search_path='' as $$ select app_private.prepare_pet_avatar_job(p_pet_id,p_client_mutation_id,p_source_asset_id,p_source_content_type,p_source_byte_size,p_consent_version,p_policy_version); $$;

create or replace function public.apply_pet_avatar(p_pet_id uuid,p_avatar_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.apply_pet_avatar(p_pet_id,p_avatar_id); $$;
revoke all on function app_private.all_care_access(uuid[],uuid) from public,anon,authenticated;
grant execute on function app_private.all_care_access(uuid[],uuid) to authenticated;
revoke all on function app_private.all_pet_owner(uuid[],uuid) from public,anon,authenticated;
grant execute on function app_private.all_pet_owner(uuid[],uuid) to authenticated;
revoke all on function app_private.apply_pet_avatar(uuid,uuid) from public,anon,authenticated;
grant execute on function app_private.apply_pet_avatar(uuid,uuid) to authenticated;
revoke all on function app_private.assert_memory_account(uuid[]) from public,anon,authenticated;
revoke all on function app_private.assert_memory_photo_limit(uuid[],date,integer,uuid) from public,anon,authenticated;
revoke all on function app_private.avatar_storage_read(text) from public,anon,authenticated;
grant execute on function app_private.avatar_storage_read(text) to authenticated;
revoke all on function app_private.can_read_memory(uuid) from public,anon,authenticated;
grant execute on function app_private.can_read_memory(uuid) to authenticated;
revoke all on function app_private.care_access(uuid,uuid) from public,anon,authenticated;
grant execute on function app_private.care_access(uuid,uuid) to authenticated;
revoke all on function app_private.create_photo_diary_entry(uuid,uuid,date,timestamptz,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function app_private.create_photo_diary_entry(uuid,uuid,date,timestamptz,text,uuid,jsonb) to authenticated;
revoke all on function app_private.daily_photo_count(uuid,date,uuid,uuid) from public,anon,authenticated;
revoke all on function app_private.delete_account_memory_drafts() from public,anon,authenticated;
revoke all on function app_private.delete_memory(uuid,integer) from public,anon,authenticated;
grant execute on function app_private.delete_memory(uuid,integer) to authenticated;
revoke all on function app_private.delete_pet_memory_resources() from public,anon,authenticated;
revoke all on function app_private.enforce_daily_diary_photo_limit() from public,anon,authenticated;
revoke all on function app_private.guard_avatar_state() from public,anon,authenticated;
revoke all on function app_private.guard_legacy_photo_date_change() from public,anon,authenticated;
revoke all on function app_private.lock_memory(uuid,uuid[]) from public,anon,authenticated;
revoke all on function app_private.lock_memory_pets(uuid[]) from public,anon,authenticated;
revoke all on function app_private.lock_photo_day(uuid,date) from public,anon,authenticated;
revoke all on function app_private.memory_pet_ids(uuid) from public,anon,authenticated;
revoke all on function app_private.memory_result(uuid) from public,anon,authenticated;
revoke all on function app_private.memory_storage_read(text) from public,anon,authenticated;
grant execute on function app_private.memory_storage_read(text) to authenticated;
revoke all on function app_private.prepare_memory(uuid,text,date,timestamptz,uuid[],jsonb) from public,anon,authenticated;
grant execute on function app_private.prepare_memory(uuid,text,date,timestamptz,uuid[],jsonb) to authenticated;
revoke all on function app_private.prepare_pet_avatar_job(uuid,uuid,uuid,text,bigint,text,text) from public,anon,authenticated;
grant execute on function app_private.prepare_pet_avatar_job(uuid,uuid,uuid,text,bigint,text,text) to authenticated;
revoke all on function app_private.publish_memory(uuid,integer) from public,anon,authenticated;
grant execute on function app_private.publish_memory(uuid,integer) to authenticated;
revoke all on function app_private.queue_resource_cleanup() from public,anon,authenticated;
revoke all on function app_private.requester_key(uuid) from public,anon,authenticated;
revoke all on function app_private.resource_storage_insert(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function app_private.resource_storage_insert(text,text,text,jsonb) to authenticated;
revoke all on function app_private.same_memory_audience(uuid[]) from public,anon,authenticated;
revoke all on function app_private.update_memory(uuid,integer,text,date,timestamptz,uuid[],uuid[]) from public,anon,authenticated;
grant execute on function app_private.update_memory(uuid,integer,text,date,timestamptz,uuid[],uuid[]) to authenticated;
revoke all on function app_private.update_photo_diary_entry(uuid,uuid,timestamptz,uuid,jsonb) from public,anon,authenticated;
grant execute on function app_private.update_photo_diary_entry(uuid,uuid,timestamptz,uuid,jsonb) to authenticated;
revoke all on function app_private.validate_memory_input(text,date,timestamptz,uuid[]) from public,anon,authenticated;
revoke all on function public.account_deletion_storage_state_v1(uuid) from public,anon,authenticated;
grant execute on function public.account_deletion_storage_state_v1(uuid) to service_role;
revoke all on function public.apply_pet_avatar(uuid,uuid) from public,anon,authenticated;
grant execute on function public.apply_pet_avatar(uuid,uuid) to authenticated;
revoke all on function public.complete_resource_cleanup_v1(text,text) from public,anon,authenticated;
grant execute on function public.complete_resource_cleanup_v1(text,text) to service_role;
revoke all on function public.delete_memory(uuid,integer) from public,anon,authenticated;
grant execute on function public.delete_memory(uuid,integer) to authenticated;
revoke all on function public.expire_memory_drafts_v1(integer) from public,anon,authenticated;
grant execute on function public.expire_memory_drafts_v1(integer) to service_role;
revoke all on function public.list_account_deletion_memory_objects_v2(uuid,integer) from public,anon,authenticated;
grant execute on function public.list_account_deletion_memory_objects_v2(uuid,integer) to service_role;
revoke all on function public.list_account_deletion_memory_rehomes_v2(uuid) from public,anon,authenticated;
grant execute on function public.list_account_deletion_memory_rehomes_v2(uuid) to service_role;
revoke all on function public.list_account_deletion_rehomes_v1(uuid) from public,anon,authenticated;
grant execute on function public.list_account_deletion_rehomes_v1(uuid) to service_role;
revoke all on function public.list_account_deletion_temporary_objects_v1(uuid) from public,anon,authenticated;
grant execute on function public.list_account_deletion_temporary_objects_v1(uuid) to service_role;
revoke all on function public.list_pending_resource_cleanup_v1(integer) from public,anon,authenticated;
grant execute on function public.list_pending_resource_cleanup_v1(integer) to service_role;
revoke all on function public.prepare_memory(uuid,text,date,timestamptz,uuid[],jsonb) from public,anon,authenticated;
grant execute on function public.prepare_memory(uuid,text,date,timestamptz,uuid[],jsonb) to authenticated;
revoke all on function public.prepare_pet_avatar_job(uuid,uuid,uuid,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.prepare_pet_avatar_job(uuid,uuid,uuid,text,bigint,text,text) to authenticated;
revoke all on function public.publish_memory(uuid,integer) from public,anon,authenticated;
grant execute on function public.publish_memory(uuid,integer) to authenticated;
revoke all on function public.rehome_account_deletion_memory_v2(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.rehome_account_deletion_memory_v2(uuid,uuid,text,text) to service_role;
revoke all on function public.rollback_account_deletion_memory_v2(uuid,uuid) from public,anon,authenticated;
grant execute on function public.rollback_account_deletion_memory_v2(uuid,uuid) to service_role;
revoke all on function public.update_memory(uuid,integer,text,date,timestamptz,uuid[],uuid[]) from public,anon,authenticated;
grant execute on function public.update_memory(uuid,integer,text,date,timestamptz,uuid[],uuid[]) to authenticated;

create or replace function public.begin_account_deletion_v1(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_pet_ids uuid[];
  result jsonb;
begin
 perform app_private.lock_pet_resource_structure();
  if p_user_id is null then
    raise exception 'A user ID is required.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('account-deletion:' || p_user_id::text, 0)
  );
  select coalesce(array_agg(pet.id order by pet.id), array[]::uuid[])
    into current_pet_ids
  from public.pets as pet
  where pet.owner_id = p_user_id;

  insert into app_private.account_deletion_jobs (user_id, owned_pet_ids)
  values (p_user_id, current_pet_ids)
  on conflict (user_id) do nothing;

  update app_private.account_deletion_jobs as job
  set owned_pet_ids = (
        select coalesce(array_agg(distinct candidate.pet_id order by candidate.pet_id), array[]::uuid[])
        from unnest(job.owned_pet_ids || current_pet_ids) as candidate(pet_id)
      ),
      updated_at = now()
  where job.user_id = p_user_id
    and job.status = 'preparing';

  select jsonb_build_object(
    'job_id', job.job_id,
    'status', job.status,
    'owned_pet_ids', to_jsonb(job.owned_pet_ids)
  ) into result
  from app_private.account_deletion_jobs as job
  where job.user_id = p_user_id;
  return result;
end;
$$;


create or replace function app_private.guard_memory_account_write()
returns trigger language plpgsql security definer set search_path='' as $$
declare requester uuid; pets uuid[];
begin
 if tg_table_name='memories' then requester:=new.created_by; pets:=app_private.memory_pet_ids(new.id);
 else select created_by into requester from public.memories where id=new.memory_id; pets:=app_private.memory_pet_ids(new.memory_id); end if;
 if exists(select 1 from app_private.account_deletion_jobs j where j.user_id=requester or exists(
 select 1 from public.pets p where p.id=any(pets) and p.owner_id=j.user_id)) then
 raise exception 'account_deletion_in_progress' using errcode='55000'; end if;
 return new;
end; $$;
create trigger guard_memory_account_insert before insert on public.memories for each row execute function app_private.guard_memory_account_write();
create trigger guard_memory_account_update before update of content,entry_date,occurred_at,status on public.memories for each row execute function app_private.guard_memory_account_write();
create trigger guard_memory_media_account_insert before insert on public.memory_media for each row execute function app_private.guard_memory_account_write();
revoke all on function app_private.guard_memory_account_write() from public,anon,authenticated;

revoke all on function public.prepare_account_deletion_memory_rehome_v2(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.prepare_account_deletion_memory_rehome_v2(uuid,uuid,text,text) to service_role;

-- Storage probes roll back; actual completeUpload runs asSuperUser in a separate transaction.
-- This deferred guard executes against the final row, including for service-role UPSERT.
create or replace function app_private.guard_resource_storage_completion()
returns trigger language plpgsql security definer set search_path='' as $$
declare object storage.objects; media public.memory_media; target public.memories;
 job public.pet_avatar_jobs; avatar public.pet_avatars; intent app_private.account_deletion_media_rehomes;
 pets uuid[]; requester uuid; expected_mime text; expected_bytes bigint; limits app_private.memory_limits;
begin
 perform app_private.lock_pet_resource_writes();
 if new.bucket_id='pet-media' and new.owner_id is not null and (
 not exists(select 1 from auth.users u where u.id::text=new.owner_id)
 or exists(select 1 from app_private.account_deletion_jobs j where j.user_id::text=new.owner_id
 or exists(select 1 from unnest(j.owned_pet_ids) p(id) where p.id::text=split_part(new.name,'/',1))
 or exists(select 1 from public.pets p where p.owner_id=j.user_id and p.id::text=split_part(new.name,'/',1)))) then
 raise exception 'account_deletion_in_progress' using errcode='55000'; end if;
 if new.bucket_id not in('memory-media','pet-avatars') then
 if tg_op='UPDATE' and old.bucket_id in('memory-media','pet-avatars') then raise exception 'resource_storage_immutable' using errcode='55000'; end if;
 return null;
 end if;
 if tg_op='UPDATE' and (new.bucket_id is distinct from old.bucket_id or new.name is distinct from old.name or new.owner_id is distinct from old.owner_id) then
 raise exception 'resource_storage_immutable' using errcode='55000'; end if;
 select * into object from storage.objects where id=new.id;
 if not found then return null; end if;
 if object.bucket_id is distinct from new.bucket_id or object.name is distinct from new.name or object.owner_id is distinct from new.owner_id then
 raise exception 'resource_storage_immutable' using errcode='55000'; end if;
 if object.bucket_id='memory-media' then
 select mm.* into media from public.memory_media mm where mm.storage_path=object.name;
 if not found then
 select r.* into intent from app_private.account_deletion_media_rehomes r where r.bucket_id='memory-media' and r.resource_kind='memory' and r.destination_path=object.name;
 if not found then raise exception 'resource_storage_reservation_missing' using errcode='55000'; end if;
 select * into media from public.memory_media where id=intent.media_asset_id;
 if not found then raise exception 'resource_storage_reservation_missing' using errcode='55000'; end if;
 end if;
 pets:=app_private.memory_pet_ids(media.memory_id);
 perform app_private.lock_memory_pets(pets);
 select * into target from public.memories where id=media.memory_id for update;
 if not found then raise exception 'resource_storage_reservation_missing' using errcode='55000'; end if;
 if pets<>app_private.memory_pet_ids(target.id) then raise exception 'memory_tags_changed_retry' using errcode='40001'; end if;
 select * into media from public.memory_media where id=media.id for update;
 if not found then raise exception 'resource_storage_reservation_missing' using errcode='55000'; end if;
 -- An ownerless account-deletion copy is a distinct, pre-reserved write path.
 if object.owner_id is null then
 select * into intent from app_private.account_deletion_media_rehomes where bucket_id='memory-media' and resource_kind='memory'
 and destination_path=object.name and media_asset_id=media.id for update;
 if not found or media.storage_path not in(intent.source_path,intent.destination_path) or target.status<>'published'
 or not exists(select 1 from app_private.account_deletion_jobs j where j.user_id=intent.user_id and j.status='preparing')
 or not exists(select 1 from auth.users where id=intent.user_id) then
 raise exception 'resource_storage_reservation_missing' using errcode='55000'; end if;
 else
 requester:=target.created_by;
 if object.name<>media.storage_path or requester is null or object.owner_id<>requester::text or target.status<>'draft'
 or target.draft_expires_at<=now() or not app_private.all_care_access(pets,requester) or not app_private.same_memory_audience(pets) then
 raise exception 'resource_storage_access_denied' using errcode='42501'; end if;
 end if;
 expected_mime:=media.content_type; expected_bytes:=media.byte_size;
 elsif object.bucket_id='pet-avatars' then
 select * into job from public.pet_avatar_jobs where source_path=object.name;
 if found then
 perform app_private.lock_memory_pets(array[job.pet_id]);
 select * into job from public.pet_avatar_jobs where id=job.id for update;
 if not found then raise exception 'resource_storage_reservation_missing' using errcode='55000'; end if;
 requester:=job.requester_id; pets:=array[job.pet_id];
 if requester is null or object.owner_id is distinct from requester::text or job.source_path<>object.name or job.status<>'queued'
 or not app_private.all_pet_owner(pets,requester) then raise exception 'resource_storage_access_denied' using errcode='42501'; end if;
 expected_mime:=job.source_content_type; expected_bytes:=job.source_byte_size;
 else
 select * into avatar from public.pet_avatars where storage_path=object.name;
 if not found then raise exception 'resource_storage_reservation_missing' using errcode='55000'; end if;
 perform app_private.lock_memory_pets(array[avatar.pet_id]);
 select * into job from public.pet_avatar_jobs where id=avatar.job_id for update;
 if not found then raise exception 'resource_storage_reservation_missing' using errcode='55000'; end if;
 select * into avatar from public.pet_avatars where id=avatar.id for update;
 if not found then raise exception 'resource_storage_reservation_missing' using errcode='55000'; end if;
 requester:=job.requester_id; pets:=array[avatar.pet_id];
 if object.owner_id is not null or avatar.storage_path<>object.name or avatar.validation_status<>'pending' or avatar.is_applied
 or job.status not in('queued','processing','ready') or not app_private.all_pet_owner(pets,requester) then
 raise exception 'resource_storage_access_denied' using errcode='42501'; end if;
 expected_mime:=avatar.content_type; expected_bytes:=avatar.byte_size;
 end if;
 end if;
 if requester is not null and (not exists(select 1 from auth.users where id=requester) or exists(
 select 1 from app_private.account_deletion_jobs j where j.user_id=requester or exists(select 1 from public.pets p where p.id=any(pets) and p.owner_id=j.user_id))) then
 raise exception 'account_deletion_in_progress' using errcode='55000'; end if;
 if exists(select 1 from app_private.resource_cleanup_jobs where bucket_id=object.bucket_id and storage_path=object.name) then
 raise exception 'resource_storage_reservation_missing' using errcode='55000'; end if;
 select * into limits from app_private.memory_limits;
 if object.metadata->>'size' is null or object.metadata->>'size' !~ '^[0-9]+$' or (object.metadata->>'size')::numeric<>expected_bytes
 or expected_bytes>limits.max_file_bytes or not(expected_mime=any(limits.mime_types)) or object.metadata->>'mimetype' is distinct from expected_mime then
 raise exception 'resource_storage_invalid_media' using errcode='22023'; end if;
 return null;
end; $$;
revoke all on function app_private.guard_resource_storage_completion() from public,anon,authenticated;
create constraint trigger resource_storage_completion after insert or update on storage.objects
 deferrable initially deferred for each row execute function app_private.guard_resource_storage_completion();

-- Existing RPC contracts retain their bodies and ACLs; acquire the gate first.
create or replace function app_private.delete_pet_v1(p_pet_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  cleanup_paths text[] := array[]::text[];
  deleted_count integer;
begin
  perform app_private.lock_pet_resource_writes();
  if actor_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if not app_private.has_pet_role(
    p_pet_id,
    actor_user_id,
    array['owner']::public.pet_member_role[]
  ) then
    raise exception 'Only the pet owner can delete the pet.' using errcode = '42501';
  end if;

  perform 1 from public.pets as pet where pet.id = p_pet_id for update;
  if not found then
    raise exception 'Pet not found.' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(candidate.storage_path order by candidate.storage_path), array[]::text[])
    into cleanup_paths
  from (
    select asset.storage_path
    from public.media_assets as asset
    where asset.pet_id = p_pet_id
    union
    select object.name
    from storage.objects as object
    where object.bucket_id = 'pet-media'
      and object.name like p_pet_id::text || '/%'
  ) as candidate;

  perform app_private.queue_media_cleanup(actor_user_id, cleanup_paths);
  delete from public.pets as pet where pet.id = p_pet_id;
  get diagnostics deleted_count = row_count;
  if deleted_count <> 1 then
    raise exception 'Pet not found.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'record', jsonb_build_object('id', p_pet_id),
    'cleanup_paths', to_jsonb(cleanup_paths)
  );
end;
$$;

create or replace function app_private.delete_diary_entry_v1(
  p_pet_id uuid,
  p_entry_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  target_entry public.diary_entries;
  cleanup_paths text[] := array[]::text[];
begin
  perform app_private.lock_memory_pets(array[p_pet_id]);
  if actor_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if not app_private.has_pet_role(
    p_pet_id,
    actor_user_id,
    array['owner']::public.pet_member_role[]
  ) then
    raise exception 'Only the pet owner can delete diary entries.' using errcode = '42501';
  end if;

  select entry.* into target_entry
  from public.diary_entries as entry
  where entry.id = p_entry_id and entry.pet_id = p_pet_id
  for update;
  if not found then
    raise exception 'Diary entry not found.' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(candidate.storage_path order by candidate.storage_path), array[]::text[])
    into cleanup_paths
  from (
    select asset.storage_path
    from public.media_assets as asset
    where asset.pet_id = p_pet_id and asset.diary_entry_id = p_entry_id
    union
    select object.name
    from storage.objects as object
    where object.bucket_id = 'pet-media'
      and object.name like p_pet_id::text || '/diary/' || p_entry_id::text || '/%'
  ) as candidate;

  perform app_private.queue_media_cleanup(actor_user_id, cleanup_paths);
  delete from public.media_assets as asset
  where asset.pet_id = p_pet_id and asset.diary_entry_id = p_entry_id;
  delete from public.diary_entries as entry
  where entry.id = p_entry_id and entry.pet_id = p_pet_id;

  return jsonb_build_object(
    'record', to_jsonb(target_entry) || jsonb_build_object('media_assets', '[]'::jsonb),
    'cleanup_paths', to_jsonb(cleanup_paths)
  );
end;
$$;

create or replace function app_private.replace_pet_profile_photo_v1(
  p_pet_id uuid,
  p_storage_path text,
  p_content_type text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  cleanup_paths text[] := array[]::text[];
begin
  perform app_private.lock_memory_pets(array[p_pet_id]);
  if actor_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if not app_private.has_pet_role(
    p_pet_id,
    actor_user_id,
    array['owner']::public.pet_member_role[]
  ) then
    raise exception 'Only the pet owner can replace the profile photo.' using errcode = '42501';
  end if;
  if p_storage_path not like p_pet_id::text || '/profile/%'
    or p_content_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'Invalid profile photo metadata.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('pet-profile-photo:' || p_pet_id::text));

  -- Keep the same pet -> media-path lock order used by delete_pet_v1. The
  -- explicit key-share lock is acquired before the media_assets trigger takes
  -- a path advisory lock, preventing a concurrent delete/replace deadlock.
  perform 1 from public.pets as pet
  where pet.id = p_pet_id
  for key share;
  if not found then
    raise exception 'Pet not found.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from storage.objects as object
    where object.bucket_id = 'pet-media'
      and object.name = p_storage_path
      and object.owner_id = actor_user_id::text
  ) then
    raise exception 'Uploaded profile photo was not found for this user.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.media_assets as asset
    where asset.pet_id = p_pet_id
      and asset.diary_entry_id is null
      and asset.storage_path = p_storage_path
  ) then
    select coalesce(array_agg(job.storage_path order by job.created_at, job.storage_path), array[]::text[])
      into cleanup_paths
    from app_private.media_cleanup_jobs as job
    where job.user_id = actor_user_id
      and job.storage_path like p_pet_id::text || '/profile/%';
    return jsonb_build_object(
      'record', jsonb_build_object('storage_path', p_storage_path),
      'cleanup_paths', to_jsonb(cleanup_paths)
    );
  end if;

  select coalesce(array_agg(candidate.storage_path order by candidate.storage_path), array[]::text[])
    into cleanup_paths
  from (
    select asset.storage_path
    from public.media_assets as asset
    where asset.pet_id = p_pet_id
      and asset.diary_entry_id is null
      and asset.storage_path like p_pet_id::text || '/profile/%'
      and asset.storage_path <> p_storage_path
    union
    select object.name
    from storage.objects as object
    where object.bucket_id = 'pet-media'
      and object.name like p_pet_id::text || '/profile/%'
      and object.name <> p_storage_path
      and object.created_at < now() - interval '1 hour'
      and not exists (
        select 1 from public.media_assets as registered
        where registered.storage_path = object.name
      )
  ) as candidate;

  insert into public.media_assets (
    pet_id, diary_entry_id, storage_path, content_type, created_by
  ) values (
    p_pet_id, null, p_storage_path, p_content_type, actor_user_id
  );

  perform app_private.queue_media_cleanup(actor_user_id, cleanup_paths);
  delete from public.media_assets as asset
  where asset.pet_id = p_pet_id
    and asset.diary_entry_id is null
    and asset.storage_path like p_pet_id::text || '/profile/%'
    and asset.storage_path <> p_storage_path;

  return jsonb_build_object(
    'record', jsonb_build_object('storage_path', p_storage_path),
    'cleanup_paths', to_jsonb(cleanup_paths)
  );
end;
$$;

create or replace function app_private.queue_media_cleanup(
  actor_user_id uuid,
  storage_paths text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_path text;
begin
  perform app_private.lock_pet_resource_writes();
  for candidate_path in
    select distinct candidate.storage_path
    from unnest(coalesce(storage_paths, array[]::text[])) as candidate(storage_path)
    where actor_user_id is not null
      and candidate.storage_path <> ''
      and candidate.storage_path !~ '(^|/)\.\.(/|$)'
    order by candidate.storage_path
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('media-cleanup:' || candidate_path, 0)
    );
    insert into app_private.media_cleanup_jobs (user_id, storage_path)
    values (actor_user_id, candidate_path)
    on conflict (user_id, storage_path) do nothing;
  end loop;
end;
$$;

create or replace function public.rehome_account_deletion_media_v1(
  p_user_id uuid,
  p_media_asset_id uuid,
  p_source_path text,
  p_destination_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_pet_id uuid;
  target_job_id uuid;
begin
  perform app_private.lock_pet_resource_writes();
  select job.job_id into target_job_id
  from app_private.account_deletion_jobs as job
  where job.user_id = p_user_id and job.status = 'preparing';
  if not found then
    raise exception 'Account deletion job was not found.' using errcode = 'P0002';
  end if;

  select asset.pet_id into target_pet_id
  from public.media_assets as asset
  where asset.id = p_media_asset_id
    and asset.storage_path = p_source_path;
  perform app_private.lock_memory_pets(array[target_pet_id]);
  perform 1 from public.media_assets where id=p_media_asset_id and pet_id=target_pet_id and storage_path=p_source_path for update;
  if not found then
    raise exception 'Registered media was not found.' using errcode = 'P0002';
  end if;
  if p_source_path = p_destination_path
    or split_part(p_destination_path, '/', 1) <> target_pet_id::text
    or position('/.account-deletion/' || target_job_id::text || '/' in p_destination_path) = 0 then
    raise exception 'Invalid account-deletion media destination.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from storage.objects as source
    where source.bucket_id = 'pet-media'
      and source.name = p_source_path
      and source.owner_id = p_user_id::text
  ) then
    raise exception 'The source object is not owned by the deleting user.' using errcode = '55000';
  end if;
  if not exists (
    select 1 from storage.objects as destination
    where destination.bucket_id = 'pet-media'
      and destination.name = p_destination_path
      and destination.owner_id is null
  ) then
    raise exception 'The ownerless destination object was not found.' using errcode = '55000';
  end if;

  perform set_config('pawbloom.account_deletion_rehome', 'on', true);
  update public.media_assets as asset
  set storage_path = p_destination_path
  where asset.id = p_media_asset_id and asset.storage_path = p_source_path;
  if not found then
    raise exception 'Registered media changed during account deletion.' using errcode = '40001';
  end if;
  insert into app_private.account_deletion_media_rehomes (
    user_id, media_asset_id, source_path, destination_path
  ) values (
    p_user_id, p_media_asset_id, p_source_path, p_destination_path
  );
end;
$$;

create or replace function public.rollback_account_deletion_rehome_v1(
  p_user_id uuid, p_media_asset_id uuid
)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  rehome app_private.account_deletion_media_rehomes%rowtype;
  target_pet_id uuid;
begin
  perform app_private.lock_pet_resource_writes();
  if not exists (
    select 1 from app_private.account_deletion_jobs
    where user_id = p_user_id and status = 'preparing'
  ) or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Only an active account can roll back preparation.' using errcode = '55000';
  end if;
  select pet_id into target_pet_id from public.media_assets where id=p_media_asset_id;
  perform app_private.lock_memory_pets(array[target_pet_id]);
  perform 1 from public.media_assets where id=p_media_asset_id for update;
  select * into rehome from app_private.account_deletion_media_rehomes
  where user_id = p_user_id and media_asset_id = p_media_asset_id for update;
  if not found then return null; end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'pet-media' and name = rehome.source_path
  ) then
    raise exception 'Original media is unavailable for rollback.' using errcode = '55000';
  end if;
  perform set_config('pawbloom.account_deletion_rehome', 'on', true);
  update public.media_assets
  set storage_path = rehome.source_path
  where id = rehome.media_asset_id and storage_path = rehome.destination_path;
  if exists (
    select 1 from public.media_assets where storage_path = rehome.destination_path
  ) then
    raise exception 'The staged copy is still referenced.' using errcode = '55000';
  end if;
  delete from app_private.account_deletion_media_rehomes
  where user_id = p_user_id and media_asset_id = p_media_asset_id;
  return rehome.destination_path;
end;
$$;

create or replace function public.cancel_account_deletion_v1(p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform app_private.lock_pet_resource_structure();
  if not exists (select 1 from auth.users where id = p_user_id)
    or exists (select 1 from app_private.account_deletion_jobs
      where user_id = p_user_id and status <> 'preparing')
    or exists (select 1 from app_private.account_deletion_media_rehomes where user_id = p_user_id)
    or exists (select 1 from public.list_account_deletion_temporary_objects_v1(p_user_id)) then
    raise exception 'Account deletion rollback is incomplete.' using errcode = '55000';
  end if;
  delete from app_private.account_deletion_jobs where user_id = p_user_id and status = 'preparing';
end;
$$;

create or replace function public.complete_account_deletion_v1(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  state jsonb;
begin
  perform app_private.lock_pet_resource_writes();
  if not exists (
    select 1 from app_private.account_deletion_jobs as job
    where job.user_id = p_user_id and job.status = 'auth_deleted'
  ) then
    raise exception 'Account deletion is not ready to complete.' using errcode = '55000';
  end if;
  select public.account_deletion_storage_state_v1(p_user_id) into state;
  if coalesce((state ->> 'user_owned_count')::bigint, 0) <> 0
    or coalesce((state ->> 'owned_pet_object_count')::bigint, 0) <> 0
    or coalesce((state ->> 'temporary_object_count')::bigint, 0) <> 0 then
    raise exception 'Account deletion Storage cleanup is incomplete.' using errcode = '55000';
  end if;
  delete from app_private.account_deletion_jobs where user_id = p_user_id;
end;
$$;

create or replace function app_private.account_deletion_blocks_media(target_storage_path text)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select target_storage_path like '%/.account-deletion/%'
    or exists (
      select 1
      from app_private.account_deletion_jobs as job
      where job.user_id = (select auth.uid())
        or exists (
          select 1
          from unnest(job.owned_pet_ids) as captured(pet_id)
          where captured.pet_id::text = split_part(target_storage_path, '/', 1)
        )
        or exists (
          select 1
          from public.pets as pet
          where pet.owner_id = job.user_id
            and pet.id::text = split_part(target_storage_path, '/', 1)
        )
    );
$$;
create trigger serialize_pet_resource_writes before insert or update or delete on public.pets for each statement execute function app_private.serialize_pet_resource_statement();
create trigger serialize_pet_resource_writes before insert or update or delete on public.pet_members for each statement execute function app_private.serialize_pet_resource_statement();
create trigger serialize_pet_resource_writes before insert or update or delete on public.memories for each statement execute function app_private.serialize_pet_resource_statement();
create trigger serialize_pet_resource_writes before insert or update or delete on public.memory_pets for each statement execute function app_private.serialize_pet_resource_statement();
create trigger serialize_pet_resource_writes before insert or update or delete on public.memory_media for each statement execute function app_private.serialize_pet_resource_statement();
create trigger serialize_pet_resource_writes before insert or update or delete on public.pet_avatar_jobs for each statement execute function app_private.serialize_pet_resource_statement();
create trigger serialize_pet_resource_writes before insert or update or delete on public.pet_avatars for each statement execute function app_private.serialize_pet_resource_statement();
create trigger serialize_pet_resource_writes before insert or update or delete on public.diary_entries for each statement execute function app_private.serialize_pet_resource_statement();
create trigger serialize_pet_resource_writes before insert or update or delete on public.media_assets for each statement execute function app_private.serialize_pet_resource_statement();
create trigger serialize_pet_resource_writes before insert or update or delete on app_private.account_deletion_jobs for each statement execute function app_private.serialize_pet_resource_statement();
create trigger serialize_pet_resource_writes before insert or update or delete on app_private.account_deletion_media_rehomes for each statement execute function app_private.serialize_pet_resource_statement();
create trigger serialize_pet_resource_writes before insert or update or delete on app_private.media_cleanup_jobs for each statement execute function app_private.serialize_pet_resource_statement();
create trigger serialize_pet_resource_writes before insert or update or delete on app_private.resource_cleanup_jobs for each statement execute function app_private.serialize_pet_resource_statement();
create trigger serialize_pet_resource_writes before delete on auth.users for each statement execute function app_private.serialize_pet_resource_structure();

-- Identity relocation is rare and must precede the compatible routine barrier.
create trigger a_resource_structure before update of pet_id,user_id on public.pet_members for each statement execute function app_private.serialize_pet_resource_structure();
create trigger a_resource_structure before update of id,owner_id on public.pets for each statement execute function app_private.serialize_pet_resource_structure();
create trigger a_resource_structure before update of pet_id,diary_entry_id on public.media_assets for each statement execute function app_private.serialize_pet_resource_structure();
create trigger a_resource_structure before update of pet_id,id on public.pet_avatar_jobs for each statement execute function app_private.serialize_pet_resource_structure();
create trigger a_resource_structure before update of pet_id,job_id,id on public.pet_avatars for each statement execute function app_private.serialize_pet_resource_structure();
