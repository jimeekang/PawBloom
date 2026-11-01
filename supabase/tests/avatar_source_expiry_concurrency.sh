#!/bin/sh
set -eu
python3 - <<'PY'
import concurrent.futures,json,os,subprocess,time,uuid
PSQL=[os.environ.get('PSQL','psql'),os.environ.get('SUPABASE_DB_URL','postgresql://postgres:postgres@127.0.0.1:54322/postgres'),'-X','-qAt','-v','ON_ERROR_STOP=1']
def sql(text):
 r=subprocess.run(PSQL,input=text,text=True,capture_output=True,timeout=20)
 if r.returncode:raise AssertionError(r.stderr)
 return r.stdout.strip()
def obj(text):return next(json.loads(line) for line in sql(text).splitlines() if line.startswith('{'))
owner,a,b=[str(uuid.uuid4()) for _ in range(3)]
sql(f"insert into auth.users(id,email) values('{owner}','{owner}@expiry-race.test');update public.subscription_entitlements set plan='family' where user_id='{owner}';insert into public.pets(id,owner_id,name,species) values('{a}','{owner}','Expiry A','cat'),('{b}','{owner}','Expiry B','cat');")
def prepare_sql(pet):
 return f"select public.prepare_pet_avatar_job('{pet}','{uuid.uuid4()}','{uuid.uuid4()}','image/png',24,'avatar-ai-2026-11-01','privacy-2026-11-01');"
def owner_sql(command):return f"set local role authenticated;select set_config('request.jwt.claim.sub','{owner}',true);"+command
def prepare(pet):return obj('begin;'+owner_sql(prepare_sql(pet))+'commit;')['job_id']
def claim_sql(job):return f"select public.claim_pet_avatar_job_v1('{job}','{owner}');"
result=json.dumps(dict(species='cat',confidence=.9,appearance=dict(version=1,coatColor='gray',coatPattern='solid',accentColor='black',eyeColor='amber',earShape='pointed',furLength='short',build='regular',tail='long',faceMark='none',collar='none')))
def finish_sql(job):return f"select public.finish_pet_avatar_job_v1('{job}','{owner}','{result}',null,null);"
def age_processing(job):
 sql(f"update public.pet_avatar_jobs set status='processing',created_at=now()-interval '2 hours' where id='{job}';update app_private.avatar_mutation_receipts set started_at=now()-interval '2 hours' where job_id='{job}';")
def race(first,second):
 app='expiry-'+str(uuid.uuid4())
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  future=pool.submit(sql,f"begin;set local application_name='{app}';{first}select pg_sleep(0.5);commit;")
  deadline=time.monotonic()+5
  while sql(f"select count(*) from pg_stat_activity where application_name='{app}' and wait_event='PgSleep';")!='1':
   if future.done():future.result();raise AssertionError('first transaction finished before barrier')
   if time.monotonic()>deadline:raise AssertionError('transaction barrier timeout')
   time.sleep(.01)
  value=obj('begin;'+second+'commit;')
  future.result()
  return value
try:
 # Completion commits while expiry waits for the complete pet set: ready must survive the recheck.
 old=prepare(b);age_processing(old)
 r=race('set local role service_role;'+finish_sql(old),owner_sql(prepare_sql(a)))
 assert r['status']=='queued'
 assert sql(f"select status from public.pet_avatar_jobs where id='{old}';")=='ready'
 assert sql(f"select count(*) from public.pet_avatars where job_id='{old}';")=='1'
 # Expiry commits first: a delayed provider completion must not resurrect its failed job.
 old=prepare(b);age_processing(old)
 r=race(owner_sql(prepare_sql(a)),'set local role service_role;'+finish_sql(old))
 assert r.get('error')=='avatar_job_closed',r
 assert sql(f"select status from public.pet_avatar_jobs where id='{old}';")=='failed'
 assert sql(f"select count(*) from public.pet_avatars where job_id='{old}';")=='0'
 # Both prepare and claim sweep old jobs across opposite current pets, in both entry orders.
 for prepare_first in [True,False]:
  old_a,old_b,current=prepare(a),prepare(b),prepare(b)
  sql(f"update public.pet_avatar_jobs set created_at=now()-interval '2 hours' where id in('{old_a}','{old_b}');")
  p=owner_sql(prepare_sql(a));c='set local role service_role;'+claim_sql(current)
  r=race(p if prepare_first else c,c if prepare_first else p)
  assert r.get('status')==('processing' if prepare_first else 'queued'),r
  assert sql(f"select count(*) from public.pet_avatar_jobs where id in('{old_a}','{old_b}') and status='failed' and error_code='avatar_provider_failed';")=='2'
  assert sql(f"select count(*) from app_private.resource_cleanup_jobs q join public.pet_avatar_jobs j on q.storage_path=j.source_path where j.id in('{old_a}','{old_b}');")=='2'
 print('expiry vs finish both orders and cross-pet prepare/claim both orders passed; no resurrection, duplicate cleanup or deadlock')
finally:
 paths=sql(f"select source_path from public.pet_avatar_jobs where requester_id='{owner}';").splitlines()
 sql(f"delete from auth.users where id='{owner}';")
 for path in paths:sql(f"select public.complete_resource_cleanup_v1('pet-avatars','{path}');")
PY
