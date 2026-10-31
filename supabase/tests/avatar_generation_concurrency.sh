#!/bin/sh
set -eu
python3 - <<'PY'
import concurrent.futures,json,os,subprocess,uuid
PSQL=[os.environ.get('PSQL','psql'),os.environ.get('SUPABASE_DB_URL','postgresql://postgres:postgres@127.0.0.1:54322/postgres'),'-X','-qAt','-v','ON_ERROR_STOP=1']
def sql(s):
 r=subprocess.run(PSQL,input=s,text=True,capture_output=True,timeout=30)
 if r.returncode: raise AssertionError(r.stderr)
 return r.stdout.strip()
def obj(s):return next(json.loads(line) for line in sql(s).splitlines() if line.startswith('{'))
owner,pet=str(uuid.uuid4()),str(uuid.uuid4())
sql(f"insert into auth.users(id,email) values('{owner}','{owner}@avatar-concurrency.test');insert into public.pets(id,owner_id,name,species) values('{pet}','{owner}','Avatar concurrent','cat');")
paths=[]
try:
 jobs=[]
 for _ in range(11):
  r=obj(f"begin;set local role authenticated;select set_config('request.jwt.claim.sub','{owner}',true);select public.prepare_pet_avatar_job('{pet}','{uuid.uuid4()}','{uuid.uuid4()}','image/png',24,'avatar-ai-2026-10-31','privacy-2026-10-31');commit;")
  jobs.append(r['job_id']);paths.append(r['source_path'])
 def claim(job):return obj(f"begin;set local role service_role;select public.claim_pet_avatar_job_v1('{job}','{owner}');commit;")
 for job in jobs[:9]:assert claim(job)['status']=='processing'
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(claim,jobs[9:]))
 assert sum(r.get('status')=='processing' for r in results)==1,results
 assert sum(r.get('error')=='avatar_daily_limit' for r in results)==1,results
 assert sql(f"select count(*) from app_private.avatar_mutation_receipts where requester_key=app_private.requester_key('{owner}') and started_at is not null;")=='10'
 print('two concurrent admissions for final quota slot: exactly one accepted')
finally:
 sql(f"delete from auth.users where id='{owner}';")
 for path in paths:sql(f"select public.complete_resource_cleanup_v1('pet-avatars','{path}');")
PY
