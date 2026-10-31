#!/bin/sh
set -eu
python3 - <<'PY'
import concurrent.futures,json,os,subprocess,time,uuid
PSQL=[os.environ.get('PSQL','psql'),os.environ.get('SUPABASE_DB_URL','postgresql://postgres:postgres@127.0.0.1:54322/postgres'),'-X','-qAt','-v','ON_ERROR_STOP=1']
def sql(text):
 r=subprocess.run(PSQL,input=text,text=True,capture_output=True,timeout=20)
 if r.returncode:raise AssertionError(r.stderr)
 return r.stdout.strip()
def obj(text):return next(json.loads(x) for x in sql(text).splitlines() if x.startswith('{'))
owner,a,b=[str(uuid.uuid4()) for _ in range(3)]
sql(f"insert into auth.users(id,email) values('{owner}','{owner}@global-expiry-race.test');update public.subscription_entitlements set plan='family' where user_id='{owner}';insert into public.pets(id,owner_id,name,species) values('{a}','{owner}','Global A','cat'),('{b}','{owner}','Global B','cat');")
def prepare_sql(pet):return f"select public.prepare_pet_avatar_job('{pet}','{uuid.uuid4()}','{uuid.uuid4()}','image/png',24,'avatar-ai-2026-10-31','privacy-2026-10-31');"
def owner_sql(command):return f"set local role authenticated;select set_config('request.jwt.claim.sub','{owner}',true);"+command
def prepare(pet):return obj('begin;'+owner_sql(prepare_sql(pet))+'commit;')['job_id']
def claim_sql(job):return f"select public.claim_pet_avatar_job_v1('{job}','{owner}');"
result=json.dumps(dict(species='cat',confidence=.9,appearance=dict(version=1,coatColor='gray',coatPattern='solid',accentColor='black',eyeColor='amber',earShape='pointed',furLength='short',build='regular',tail='long',faceMark='none',collar='none')))
def finish_sql(job):return f"select public.finish_pet_avatar_job_v1('{job}','{owner}','{result}',null,null);"
def age(job,processing=False):
 sql(f"update public.pet_avatar_jobs set created_at=now()-interval '2 hours',status='{'processing' if processing else 'queued'}' where id='{job}';"+(f"update app_private.avatar_mutation_receipts set started_at=now()-interval '11 minutes' where job_id='{job}';" if processing else ''))
sweep='select app_private.expire_all_avatar_source_jobs();'
def race(first,second):
 app='global-expiry-'+str(uuid.uuid4())
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  future=pool.submit(sql,f"begin;set local application_name='{app}';{first}select pg_sleep(0.4);commit;")
  deadline=time.monotonic()+5
  while sql(f"select count(*) from pg_stat_activity where application_name='{app}' and wait_event='PgSleep';")!='1':
   if future.done():future.result();raise AssertionError('first transaction missed barrier')
   if time.monotonic()>deadline:raise AssertionError('barrier timeout')
   time.sleep(.01)
  value=sql('begin;'+second+'commit;');future.result();return value
try:
 old=prepare(b);age(old,True)
 race('set local role service_role;'+finish_sql(old),sweep)
 assert sql(f"select status from public.pet_avatar_jobs where id='{old}';")=='ready'
 old=prepare(b);age(old,True)
 value=race(sweep,'set local role service_role;'+finish_sql(old))
 assert next(json.loads(x) for x in value.splitlines() if x.startswith('{')).get('error')=='avatar_job_closed'
 assert sql(f"select count(*) from public.pet_avatars where job_id='{old}';")=='0'
 old=prepare(b);age(old)
 race(sweep,sweep)
 assert sql(f"select count(*) from app_private.resource_cleanup_jobs q join public.pet_avatar_jobs j on q.storage_path=j.source_path where j.id='{old}';")=='1'
 for operation in ['prepare','claim']:
  for sweep_first in [True,False]:
   old_a,old_b,current=prepare(a),prepare(b),prepare(b)
   age(old_a);age(old_b)
   command=owner_sql(prepare_sql(a)) if operation=='prepare' else 'set local role service_role;'+claim_sql(current)
   race(sweep if sweep_first else command,command if sweep_first else sweep)
   assert sql(f"select count(*) from public.pet_avatar_jobs where id in('{old_a}','{old_b}') and status='failed';")=='2'
   assert sql(f"select count(*) from app_private.resource_cleanup_jobs q join public.pet_avatar_jobs j on q.storage_path=j.source_path where j.id in('{old_a}','{old_b}');")=='2'
 print('global sweep vs finish/prepare/claim both orders and two sweeps passed; no resurrection/duplicate cleanup/deadlock')
finally:
 paths=sql(f"select source_path from public.pet_avatar_jobs where requester_id='{owner}';").splitlines()
 sql(f"delete from auth.users where id='{owner}';")
 for path in paths:sql(f"select public.complete_resource_cleanup_v1('pet-avatars','{path}');")
PY
