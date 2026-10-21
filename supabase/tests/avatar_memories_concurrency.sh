#!/bin/sh
set -eu
python3 - <<'PY'
import subprocess,os,uuid,time,json
PSQL=[os.environ.get('PSQL','psql'),os.environ.get('SUPABASE_DB_URL','postgresql://postgres:postgres@127.0.0.1:54322/postgres'),'-X','-v','ON_ERROR_STOP=1','-At','--set=VERBOSITY=verbose']
def uid(): return str(uuid.uuid4())
def run(sql,ok=True):
 r=subprocess.run(PSQL,input=sql,text=True,capture_output=True,timeout=15)
 if ok and r.returncode: raise AssertionError(r.stderr)
 return r
owner,care,pet=uid(),uid(),uid()
helper1,helper2=uid(),uid()
active_sessions=[];bulk_pause_names=[];bulk_users=[]
def actor(user): return f"set local role authenticated; select set_config('request.jwt.claim.sub','{user}',true);"
def lock_session(sql):
 p=subprocess.Popen(PSQL,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
 active_sessions.append(p)
 p.stdin.write('begin;\n'+sql+'\n\\echo LOCK_READY\n');p.stdin.flush()
 while True:
  line=p.stdout.readline()
  if 'LOCK_READY' in line: return p
  if not line: raise AssertionError(p.stderr.read())
def release(p,commit=True):
 p.stdin.write(('commit;' if commit else 'rollback;')+'\n\\q\n');p.stdin.flush();p.wait(timeout=10)
 if p.returncode: raise AssertionError(p.stderr.read())
def contender(sql,wait=True):
 p=subprocess.Popen(PSQL,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 active_sessions.append(p)
 name='p1-race-'+uid();p.p1_name=name
 p.stdin.write(f"set application_name='{name}';\n"+sql);p.stdin.close()
 if not wait:return p
 for attempt in range(50):
  if p.poll() is not None: raise AssertionError('contender did not wait on a conflicting resource: '+p.stderr.read())
  waiting=run(f"select exists(select 1 from pg_stat_activity a where a.application_name='{name}' and cardinality(pg_blocking_pids(a.pid))>0);").stdout.strip()
  if waiting=='t':break
  time.sleep(.05)
 else:raise AssertionError('contender did not wait on a conflicting resource')
 return p
def finish(p,expected=None):
 p.wait(timeout=10);out=p.stdout.read();err=p.stderr.read()
 if expected:
  if p.returncode==0 or expected not in err: raise AssertionError('wrong loser result: '+out+err)
 elif p.returncode: raise AssertionError(err)
run(f"insert into auth.users(id,email) values('{owner}','{owner}@concurrency.test'),('{care}','{care}@concurrency.test'); insert into public.pets(id,owner_id,name,species) values('{pet}','{owner}','Concurrency','dog'); insert into public.pet_members(pet_id,user_id,role) values('{pet}','{care}','caregiver');")
try:
 run(f"insert into auth.users(id,email) values('{helper1}','{helper1}@concurrency.test'),('{helper2}','{helper2}@concurrency.test');")
 # Pause one row of one service-role bulk statement after its tuple/FK lock.
 def await_wait(p):
  for attempt in range(100):
   if p.poll() is not None:raise AssertionError('expected waiter exited: '+p.stderr.read())
   if run(f"select exists(select 1 from pg_stat_activity where application_name='{p.p1_name}' and cardinality(pg_blocking_pids(pid))>0);").stdout.strip()=='t':return
   time.sleep(.02)
  raise AssertionError('expected real database lock wait')
 def install_pause(event,first,field='id'):
  name='p1_bulk_'+uuid.uuid4().hex;key='pause-'+uid()
  row='new' if event=='insert' else 'old'
  run(f"create function app_private.{name}() returns trigger language plpgsql as $$begin if {row}.{field}='{first}'::uuid then perform pg_advisory_xact_lock(hashtextextended('{key}',0));end if;return {'old' if event=='delete' else 'new'};end;$$;create trigger zz_{name} {'after' if event=='insert' else 'before'} {event} on public.pet_members for each row execute function app_private.{name}();")
  bulk_pause_names.append(name)
  return name,key
 def uninstall_pause(name):
  run(f"drop trigger zz_{name} on public.pet_members;drop function app_private.{name}();")
  bulk_pause_names.remove(name)
 bulk_cases=0
 for operation in ['delete','update']:
  for reverse in [False,True]:
   for repetition in range(3):
    u,c1,c2,target=[uid() for _ in range(4)];bulk_users.extend([u,c1,c2])
    low='00000000-0000-0000-0000-'+uuid.uuid4().hex[:12];high='ffffffff-ffff-ffff-ffff-'+uuid.uuid4().hex[:12]
    rows=[(high,c2),(low,c1)] if reverse else [(low,c1),(high,c2)]
    run(f"insert into auth.users(id,email) values('{u}','{u}@bulk.test'),('{c1}','{c1}@bulk.test'),('{c2}','{c2}@bulk.test');insert into public.pets(id,owner_id,name,species) values('{target}','{u}','Bulk memory','dog');"+''.join(f"insert into public.pet_members(id,pet_id,user_id,role) values('{mid}','{target}','{who}','caregiver');" for mid,who in rows))
    name,key=install_pause(operation,rows[0][0]);control=lock_session(f"select pg_advisory_xact_lock(hashtextextended('{key}',0));")
    writer=contender("begin;set local role service_role;set local enable_indexscan=off;set local enable_bitmapscan=off;"+(f"delete from public.pet_members where pet_id='{target}' and role='caregiver';" if operation=='delete' else f"update public.pet_members set ends_at=now()-interval '1 day' where pet_id='{target}' and role='caregiver';")+'commit;',False)
    await_wait(writer)
    command=contender('begin;'+actor(c1)+f"select public.prepare_memory('{uid()}','bulk auth',current_date,now(),array['{target}'::uuid],'[]');commit;")
    # The failed attempt must release pets, and (on reverse order) its low member.
    run(f"begin;select id from public.pets where id='{target}' for update nowait;"+(f"select id from public.pet_members where id='{low}' for update nowait;" if reverse else '')+'rollback;')
    release(control);finish(writer);finish(command,'memory_access_denied')
    uninstall_pause(name);run(f"delete from public.pets where id='{target}';delete from auth.users where id in('{u}','{c1}','{c2}');")
    bulk_cases+=1
 print(f'{bulk_cases} single bulk caregiver DELETE/period UPDATE races, both physical orders x3, fresh auth denial and released pet/member locks verified; zero 40P01.')
 # A bulk INSERT may hold the high pet FK and then request the low pet FK.
 for reverse in [False,True]:
  for repetition in range(3):
   u,c,p1,p2=[uid() for _ in range(4)];bulk_users.extend([u,c]);p1,p2=sorted([p1,p2]);order=[p2,p1] if reverse else [p1,p2]
   run(f"insert into auth.users(id,email) values('{u}','{u}@bulk-insert.test'),('{c}','{c}@bulk-insert.test');update public.subscription_entitlements set plan='family' where user_id='{u}';insert into public.pets(id,owner_id,name,species) values('{p1}','{u}','Low','dog'),('{p2}','{u}','High','dog');")
   name,key=install_pause('insert',order[0],'pet_id');control=lock_session(f"select pg_advisory_xact_lock(hashtextextended('{key}',0));")
   writer=contender(f"begin;set local role service_role;insert into public.pet_members(pet_id,user_id,role) values('{order[0]}','{c}','caregiver'),('{order[1]}','{c}','caregiver');commit;",False);await_wait(writer)
   command=contender('begin;'+actor(u)+f"select public.prepare_memory('{uid()}','bulk audience',current_date,now(),array['{p1}'::uuid,'{p2}'::uuid],'[]');commit;")
   if reverse:run(f"begin;select id from public.pets where id='{p1}' for update nowait;rollback;")
   release(control);finish(writer);finish(command)
   uninstall_pause(name);run(f"delete from public.pets where id in('{p1}','{p2}');delete from auth.users where id in('{u}','{c}');")
 print('6 cross-pet single bulk INSERT FK orders x3 passed; all-or-none pet rollback verified, zero 40P01.')
 # Pet cascades prelock all members before deleting any, including a reverse bulk writer.
 cascade_cases=0
 for operation in ['delete','update']:
  for reverse in [False,True]:
   for repetition in range(3):
    u,c1,c2,target=[uid() for _ in range(4)];bulk_users.extend([u,c1,c2]);low='00000000-0000-0000-0000-'+uuid.uuid4().hex[:12];high='ffffffff-ffff-ffff-ffff-'+uuid.uuid4().hex[:12]
    rows=[(high,c2),(low,c1)] if reverse else [(low,c1),(high,c2)]
    run(f"insert into auth.users(id,email) values('{u}','{u}@cascade.test'),('{c1}','{c1}@cascade.test'),('{c2}','{c2}@cascade.test');insert into public.pets(id,owner_id,name,species) values('{target}','{u}','Cascade','dog');"+''.join(f"insert into public.pet_members(id,pet_id,user_id,role) values('{mid}','{target}','{who}','caregiver');" for mid,who in rows))
    name,key=install_pause(operation,rows[0][0]);control=lock_session(f"select pg_advisory_xact_lock(hashtextextended('{key}',0));")
    writer=contender("begin;set local role service_role;set local enable_indexscan=off;set local enable_bitmapscan=off;"+(f"delete from public.pet_members where pet_id='{target}' and role='caregiver';" if operation=='delete' else f"update public.pet_members set ends_at=now()-interval '1 day' where pet_id='{target}' and role='caregiver';")+'commit;',False);await_wait(writer)
    deletion=contender('begin;'+actor(u)+f"select public.delete_pet_v1('{target}');commit;")
    if reverse:run(f"begin;select id from public.pet_members where id='{low}' for update nowait;rollback;")
    release(control);finish(writer);finish(deletion)
    if run(f"select not exists(select 1 from public.pets where id='{target}') and not exists(select 1 from public.pet_members where pet_id='{target}');").stdout.strip()!='t':raise AssertionError('bulk cascade state')
    uninstall_pause(name);run(f"delete from auth.users where id in('{u}','{c1}','{c2}');");cascade_cases+=1
 print(f'{cascade_cases} single bulk caregiver DELETE/period UPDATE vs pet cascade races passed; both physical orders x3, zero 40P01.')
 blocker=lock_session(f"update public.pet_members set ends_at=ends_at where pet_id='{pet}' and user_id='{care}';")
 try:
  timeout=run("begin;set local lock_timeout='200ms';"+actor(owner)+f"select public.prepare_memory('{uid()}','timeout',current_date,now(),array['{pet}'::uuid],'[]');commit;",False)
  if timeout.returncode==0 or '55P03' not in timeout.stderr or 'lock timeout' not in timeout.stderr:raise AssertionError('blocking probe swallowed lock_timeout: '+timeout.stderr)
 finally:release(blocker,False)
 print('blocking single-row probe propagates actual lock_timeout (55P03).')
 # Five holders x four unrelated writers, each constrained below a second.
 def diary(u,p):
  return f"insert into public.diary_entries(id,pet_id,created_by,category,entry_date,occurred_at,summary,client_mutation_id) values('{uid()}','{p}','{u}','memo',current_date,now(),'unrelated write','{uid()}');"
 def photo(u,p,day):
  entry=uid();path=f'{p}/diary/{entry}/source'
  run(f"insert into storage.objects(bucket_id,name,owner_id,metadata) values('pet-media','{path}','{u}','{{}}');")
  return actor(u)+f"select public.create_photo_diary_entry('{entry}','{p}',current_date+{day},now()+interval '{day} day','independent','{uid()}','[{{\"storage_path\":\"{path}\",\"content_type\":\"image/jpeg\"}}]');"
 def prepared(u,p):
  out=run('begin;'+actor(u)+f"select public.prepare_memory('{uid()}','independent',current_date,now(),array['{p}'::uuid],'[]');commit;").stdout
  return next(json.loads(line)['memory_id'] for line in out.splitlines() if line.startswith('{'))
 matrix=0
 for holder_kind in ['diary','photo','publish','member','delete','profile','avatar','avatar-status']:
  for writer_kind in (['diary'] if holder_kind in ['profile','avatar','avatar-status'] else ['diary','photo','memory','member']):
   ua,ub,pa,pb,ma,mb=[uid() for _ in range(6)]
   run(f"insert into auth.users(id,email) values('{ua}','{ua}@nonblock.test'),('{ub}','{ub}@nonblock.test'),('{ma}','{ma}@nonblock.test'),('{mb}','{mb}@nonblock.test');insert into public.pets(id,owner_id,name,species) values('{pa}','{ua}','A','dog'),('{pb}','{ub}','B','dog');")
   try:
    if holder_kind=='diary':holder=diary(ua,pa)
    elif holder_kind=='photo':holder=photo(ua,pa,50)
    elif holder_kind=='publish':holder=actor(ua)+f"select public.publish_memory('{prepared(ua,pa)}',1);"
    elif holder_kind=='member':holder=f"insert into public.pet_members(pet_id,user_id,role) values('{pa}','{ma}','caregiver');"
    elif holder_kind=='profile':holder=f"update public.pets set name='changed' where id='{pa}';"
    elif holder_kind=='avatar':holder=actor(ua)+f"select public.prepare_pet_avatar_job('{pa}','{uid()}','{uid()}','image/png',100,'v1','v1');"
    elif holder_kind=='avatar-status':
     job=uid();run(f"insert into public.pet_avatar_jobs(id,pet_id,requester_id,client_mutation_id,source_path,source_content_type,source_byte_size,consent_version,policy_version) values('{job}','{pa}','{ua}','{uid()}','{pa}/{job}/{uid()}','image/png',100,'v1','v1');")
     holder=f"set local role service_role;update public.pet_avatar_jobs set status='processing' where id='{job}';"
    else:holder=actor(ua)+f"select public.delete_pet_v1('{pa}');"
    if writer_kind=='diary':writer=diary(ub,pb)
    elif writer_kind=='photo':writer=photo(ub,pb,50)
    elif writer_kind=='memory':writer=actor(ub)+f"select public.publish_memory((public.prepare_memory('{uid()}','independent',current_date,now(),array['{pb}'::uuid],'[]')->>'memory_id')::uuid,1);"
    else:writer=f"insert into public.pet_members(pet_id,user_id,role) values('{pb}','{mb}','caregiver');"
    a=lock_session(holder)
    try:run("begin;set local lock_timeout='900ms';"+writer+'commit;')
    finally:release(a,False)
    matrix+=1
   finally:run(f"delete from public.pets where id in('{pa}','{pb}');delete from auth.users where id in('{ua}','{ub}','{ma}','{mb}');")
 a=lock_session('select app_private.lock_pet_resource_writes();')
 try:run("begin;set local lock_timeout='900ms';update public.diary_entries set summary=summary where false;commit;")
 finally:release(a,False)
 print(f'{matrix} unrelated-pet write combinations and zero-row diary UPDATE passed below lock_timeout.')
 # Three-way FK KEY SHARE + pet lock promotion previously deadlocked one INSERT.
 for attempt in range(3):
  a=lock_session(f"update public.pets set name='profile holder' where id='{pet}';")
  b=contender(f"begin;set local role service_role;insert into public.pet_members(pet_id,user_id,role) values('{pet}','{helper1}','caregiver');commit;",False)
  c=contender(f"begin;set local role service_role;insert into public.pet_members(pet_id,user_id,role) values('{pet}','{helper2}','caregiver');commit;",False)
  release(a,False);finish(b);finish(c)
  run(f"update public.pet_members set starts_at=now()-interval '1 day' where pet_id='{pet}' and user_id in('{helper1}','{helper2}');delete from public.pet_members where pet_id='{pet}' and user_id in('{helper1}','{helper2}');")
 print('3 profile UPDATE + two concurrent caregiver INSERT repetitions passed; period UPDATE/DELETE passed.')
 # Membership writer first: prepare must wait and then observe the revoked caregiver.
 a=lock_session(f"update public.pet_members set ends_at=now()-interval '1 day' where pet_id='{pet}' and user_id='{care}';")
 b=contender(f"begin; {actor(care)} select public.prepare_memory('{uid()}','blocked',current_date,now(),array['{pet}'::uuid],'[]'); commit;")
 release(a);finish(b,'memory_access_denied')
 run(f"update public.pet_members set ends_at=null where pet_id='{pet}' and user_id='{care}';")
 # Command first: membership writer must wait for the command's pet lock.
 a=lock_session(f"{actor(care)} select public.prepare_memory('{uid()}','serialized',current_date,now(),array['{pet}'::uuid],'[]');")
 b=contender(f"update public.pet_members set ends_at=now()-interval '1 day' where pet_id='{pet}' and user_id='{care}';")
 release(a);finish(b)
 # Both last-photo directions share the same lock/count. Each run uses a separate local date.
 for day,memory_first in [(0,True),(1,False)]:
  mid,mutation,asset,legacy,newentry,newmutation=uid(),uid(),uid(),uid(),uid(),uid()
  data=[dict(asset_id=asset,content_type='image/jpeg',byte_size=100,position=0)]
  r=run(f"begin; {actor(owner)} select public.prepare_memory('{mutation}','last slot',current_date+{day},now()+interval '{day} day',array['{pet}'::uuid],'{json.dumps(data)}'); commit;")
  result=next(json.loads(line) for line in r.stdout.splitlines() if line.startswith('{'))
  mid=result['memory_id'];path=result['media'][0]['storage_path'];newpath=f'{pet}/diary/{newentry}/source'
  run(f"insert into storage.objects(bucket_id,name,owner_id,metadata) values('memory-media','{path}','{owner}','{{\"size\":100,\"mimetype\":\"image/jpeg\"}}'),('pet-media','{newpath}','{owner}','{{}}'); insert into public.diary_entries(id,pet_id,created_by,category,entry_date,occurred_at,summary,client_mutation_id) values('{legacy}','{pet}','{owner}','photo',current_date+{day},now()+interval '{day} day','4 photos','{uid()}'); insert into public.media_assets(pet_id,diary_entry_id,storage_path,content_type,created_by) select '{pet}','{legacy}','{pet}/diary/{legacy}/'||i,'image/jpeg','{owner}' from generate_series(1,4) i;")
  publish=f"select public.publish_memory('{mid}',1);"
  create=f"select public.create_photo_diary_entry('{newentry}','{pet}',current_date+{day},now()+interval '{day} day','last','{newmutation}','[{{\"storage_path\":\"{newpath}\",\"content_type\":\"image/jpeg\"}}]');"
  a=lock_session(actor(owner)+(publish if memory_first else create))
  b=contender('begin; '+actor(owner)+(create if memory_first else publish)+' commit;')
  release(a);finish(b,'Daily diary photo limit is 5.' if memory_first else 'memory_photo_limit_reached')
 print('4 two-session membership/last-photo serialization assertions passed.')
 for deletion_first in [False,True]:
  entry,asset=uid(),uid(); path=f'{pet}/diary/{entry}/source'
  run(f"insert into storage.objects(bucket_id,name,owner_id,metadata) values('pet-media','{path}','{owner}','{{}}');insert into public.diary_entries(id,pet_id,created_by,category,entry_date,occurred_at,summary,client_mutation_id) values('{entry}','{pet}','{owner}','photo',current_date+10,now()+interval '10 day','registration race','{uid()}');")
  begin=f"select public.begin_account_deletion_v1('{owner}');"
  registration=f"insert into public.media_assets(id,pet_id,diary_entry_id,storage_path,content_type,created_by) values('{asset}','{pet}','{entry}','{path}','image/png','{owner}');"
  a=lock_session(begin if deletion_first else registration)
  b=contender('begin;'+(registration if deletion_first else begin)+'commit;')
  release(a);finish(b,'Account deletion is already in progress.' if deletion_first else None)
  if run(f"select count(*) from public.media_assets where id='{asset}';").stdout.strip()!=('0' if deletion_first else '1'):raise AssertionError('legacy registration/account final state')
  run(f"select public.cancel_account_deletion_v1('{owner}');delete from public.diary_entries where id='{entry}';")
 print('2 account begin/legacy registration entry orders passed with fresh post-wait checks.')

 # Normal API/DML entry points must acquire the gate before locking any tuple.
 deletion_cases=0
 if run("select has_table_privilege('authenticated','public.pets','DELETE');").stdout.strip()!='f':raise AssertionError('authenticated direct pet DELETE unexpectedly enabled')
 for mode in ['rpc','raw','account']:
  for operation in (['delete','insert','update'] if mode=='rpc' else ['delete']):
   for delete_first in [False,True]:
    for repetition in range(3):
     who,member,target,sibling=uid(),uid(),uid(),uid()
     memory,mutation,media,job,avatar,external,contribution= [uid() for _ in range(7)]
     memorypath=f'{memory}/{mutation}/{media}';source=f'{target}/{job}/{uid()}';output=f'{target}/{job}/{avatar}'
     run(f"insert into auth.users(id,email) values('{who}','{who}@delete-race.test'),('{member}','{member}@delete-race.test');insert into public.pets(id,owner_id,name,species) values('{target}','{who}','Delete race','dog'),('{sibling}','{helper1}','Surviving tag','dog'),('{external}','{helper2}','Contribution pet','dog');insert into public.pet_members(pet_id,user_id,role) values('{target}','{member}','caregiver');insert into public.memories(id,created_by,content,entry_date,occurred_at,status,client_mutation_id,draft_expires_at) values('{memory}','{who}','joint deletion',current_date,now(),'published','{mutation}',now()+interval '1 day'),('{contribution}','{who}','retained contribution',current_date,now(),'published','{uid()}',now()+interval '1 day');insert into public.memory_pets values('{memory}','{target}'),('{memory}','{sibling}'),('{contribution}','{external}');insert into public.memory_media(id,memory_id,storage_path,content_type,byte_size,position,client_mutation_id) values('{media}','{memory}','{memorypath}','image/png',100,0,'{mutation}');insert into public.pet_avatar_jobs(id,pet_id,requester_id,client_mutation_id,source_path,source_content_type,source_byte_size,consent_version,policy_version) values('{job}','{target}','{who}','{uid()}','{source}','image/png',100,'v1','v1');insert into public.pet_avatars(id,pet_id,job_id,style_version,manifest_version,storage_path,content_type,byte_size) values('{avatar}','{target}','{job}','v1','v1','{output}','image/png',100);")
     if operation=='insert':run(f"delete from public.pet_members where pet_id='{target}' and user_id='{member}';")
     if mode=='account':
      run(f"select public.begin_account_deletion_v1('{who}');")
      deletion=f"delete from auth.users where id='{who}';"
     elif mode=='raw':deletion=f"delete from public.pets where id='{target}';"
     else:deletion=actor(who)+f"select public.delete_pet_v1('{target}');"
     if operation=='delete':change=f"delete from public.pet_members where pet_id='{target}' and user_id='{member}';"
     elif operation=='insert':change=f"insert into public.pet_members(pet_id,user_id,role) values('{target}','{member}','caregiver');"
     else:change=f"update public.pet_members set ends_at=now()+interval '1 day' where pet_id='{target}' and user_id='{member}';"
     change='set local role service_role;'+change
     first,second=(deletion,change) if delete_first else (change,deletion)
     a=lock_session(first)
     b=contender('begin;'+second+'commit;',False)
     release(a)
     finish(b,'23503' if delete_first and operation=='insert' else None)
     creator_condition='created_by is null' if mode=='account' else f"created_by='{who}'"
     state=run(f"select (not exists(select 1 from public.pets where id='{target}')) and (not exists(select 1 from public.pet_members where pet_id='{target}')) and (not exists(select 1 from public.memories where id='{memory}')) and (not exists(select 1 from public.memory_pets where memory_id='{memory}')) and (not exists(select 1 from public.memory_media where id='{media}')) and (not exists(select 1 from public.pet_avatar_jobs where id='{job}')) and (not exists(select 1 from public.pet_avatars where id='{avatar}')) and exists(select 1 from public.pets where id='{sibling}') and (select count(*)=3 from app_private.resource_cleanup_jobs where storage_path in('{memorypath}','{source}','{output}')) and exists(select 1 from public.memories where id='{contribution}' and {creator_condition});").stdout.strip()
     if state!='t':raise AssertionError(f'deletion final-state mismatch {mode}/{operation}/{delete_first}: {state}')
     # Repeated queue inventory is safe; no object is ACKed by these assertions.
     run("select count(*) from public.list_pending_resource_cleanup_v1(1000);select count(*) from public.list_pending_resource_cleanup_v1(1000);")
     run(f"delete from public.pets where id in('{sibling}','{external}');delete from auth.users where id in('{who}','{member}');")
     deletion_cases+=1
 print(f'{deletion_cases} delete/member races passed (3 repetitions x both entry orders), zero 40P01; whole-memory deletion, surviving tag, account contribution anonymization, and cleanup paths verified.')

 # Legacy date edits already hold a diary tuple: they must never request a pet lock.
 for command in ['append','publish']:
  for date_first in [False,True]:
   entry,mutation=uid(),uid();base=70+(5 if command=='publish' else 0)+(2 if date_first else 0)
   run(f"insert into public.diary_entries(id,pet_id,created_by,category,entry_date,occurred_at,summary,client_mutation_id) values('{entry}','{pet}','{owner}','photo',current_date+{base},now()+interval '{base} day','date race','{mutation}');insert into public.media_assets(pet_id,diary_entry_id,storage_path,content_type,created_by) values('{pet}','{entry}','{pet}/diary/{entry}/original','image/jpeg','{owner}');")
   command_day=base+1 if date_first else base
   date_sql=f"update public.diary_entries set entry_date=current_date+{base+1},occurred_at=now()+interval '{base+1} day' where id='{entry}';"
   if command=='append':command_sql=actor(owner)+f"select public.update_photo_diary_entry('{entry}','{pet}',now()+interval '{command_day} day','{uid()}','[]');"
   else:
    out=run('begin;'+actor(owner)+f"select public.prepare_memory('{uid()}','date race',current_date+{command_day},now()+interval '{command_day} day',array['{pet}'::uuid],'[]');commit;").stdout
    mid=next(json.loads(line)['memory_id'] for line in out.splitlines() if line.startswith('{'))
    command_sql=actor(owner)+f"select public.publish_memory('{mid}',1);"
   first,second=(date_sql,command_sql) if date_first else (command_sql,date_sql)
   a=lock_session(first);b=contender('begin;'+second+'commit;',False);release(a);finish(b)
   if run(f"select entry_date=current_date+{base+1} from public.diary_entries where id='{entry}';").stdout.strip()!='t':raise AssertionError('legacy date race state')
 print('4 legacy date UPDATE / append-or-publish entry orders passed, zero 40P01.')
 run(f"update public.subscription_entitlements set plan='family' where user_id='{owner}';")
 # Provider status updates never lock the parent after their child tuple.
 for delete_first in [False,True]:
  for repetition in range(3):
   target,job=uid(),uid();source=f'{target}/{job}/{uid()}'
   run(f"insert into public.pets(id,owner_id,name,species) values('{target}','{owner}','Avatar race','dog');insert into public.pet_avatar_jobs(id,pet_id,requester_id,client_mutation_id,source_path,source_content_type,source_byte_size,consent_version,policy_version) values('{job}','{target}','{owner}','{uid()}','{source}','image/png',100,'v1','v1');")
   delete=f"delete from public.pets where id='{target}';";update=f"set local role service_role;update public.pet_avatar_jobs set status='processing' where id='{job}';"
   a=lock_session(delete if delete_first else update);b=contender('begin;'+(update if delete_first else delete)+'commit;',False);release(a);finish(b)
   if run(f"select not exists(select 1 from public.pet_avatar_jobs where id='{job}') and exists(select 1 from app_private.resource_cleanup_jobs where storage_path='{source}');").stdout.strip()!='t':raise AssertionError('avatar race cleanup')
 print('6 service avatar status UPDATE / pet DELETE races passed, zero 40P01.')
 # Two deleting pets may share multiple memories; sort memory rows before cascading.
 for reverse in [False,True]:
  for repetition in range(3):
   p1,p2=uid(),uid();m1,m2=uid(),uid();jointowner=uid()
   run(f"insert into auth.users(id,email) values('{jointowner}','{jointowner}@joint-race.test');update public.subscription_entitlements set plan='family' where user_id='{jointowner}';")
   run(f"insert into public.pets(id,owner_id,name,species) values('{p1}','{jointowner}','Joint A','dog'),('{p2}','{jointowner}','Joint B','dog');insert into public.memories(id,created_by,content,entry_date,occurred_at,status,client_mutation_id,draft_expires_at) values('{m1}','{owner}','A',current_date,now(),'published','{uid()}',now()+interval '1 day'),('{m2}','{owner}','B',current_date,now(),'published','{uid()}',now()+interval '1 day');insert into public.memory_pets values('{m1}','{p1}'),('{m2}','{p2}'),('{m1}','{p2}'),('{m2}','{p1}');")
   first,second=(p2,p1) if reverse else (p1,p2)
   a=lock_session(f"delete from public.pets where id='{first}';");b=contender(f"delete from public.pets where id='{second}';");release(a);finish(b)
   if run(f"select not exists(select 1 from public.pets where id in('{p1}','{p2}')) and not exists(select 1 from public.memories where id in('{m1}','{m2}')) and not exists(select 1 from public.memory_pets where memory_id in('{m1}','{m2}'));").stdout.strip()!='t':raise AssertionError('joint delete state')
   run(f"delete from auth.users where id='{jointowner}';")
 print('6 multi-memory two-pet DELETE entry orders passed, zero 40P01.')

finally:
 for session in active_sessions:
  if session.poll() is None:session.terminate();session.wait(timeout=5)
 for name in bulk_pause_names:run(f"drop trigger if exists zz_{name} on public.pet_members;drop function if exists app_private.{name}();")
 if bulk_users:run("delete from auth.users where id in("+','.join("'"+u+"'" for u in bulk_users)+");")
 # Preserve managed Storage safety: only test DB rows are deleted; queue records retain every path.
 run(f"delete from public.pets where id='{pet}'; delete from auth.users where id in('{owner}','{care}','{helper1}','{helper2}');")
PY
