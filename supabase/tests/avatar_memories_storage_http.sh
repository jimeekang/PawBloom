#!/bin/sh
set -eu
python3 - <<'PY'
import subprocess,os,json,uuid,time,base64,hmac,hashlib,http.client,socket,concurrent.futures
PSQL=[os.environ.get('PSQL','psql'),os.environ.get('SUPABASE_DB_URL','postgresql://postgres:postgres@127.0.0.1:54322/postgres'),'-X','-v','ON_ERROR_STOP=1','-At']
def sql(s):
 r=subprocess.run(PSQL,input=s,text=True,capture_output=True,timeout=15)
 if r.returncode: raise AssertionError(r.stderr)
 return r.stdout.strip()
containers=subprocess.check_output(['docker','ps','--format','{{.Names}}'],text=True).splitlines()
name=next(n for n in containers if n.startswith('supabase_storage_'))
config=json.loads(subprocess.check_output(['docker','inspect',name]))[0]
local_env=dict(e.split('=',1) for e in config['Config']['Env'])
def b64(v):return base64.urlsafe_b64encode(v).rstrip(b'=')
def token(user):
 body=b'.'.join([b64(b'{"alg":"HS256","typ":"JWT"}'),b64(json.dumps(dict(sub=user,role='authenticated',aud='authenticated',exp=int(time.time())+300)).encode())])
 return (body+b'.'+b64(hmac.new(local_env['AUTH_JWT_SECRET'].encode(),body,hashlib.sha256).digest())).decode()
def req(method,path,body,auth,ctype='application/json'):
 c=http.client.HTTPConnection('127.0.0.1',54321,timeout=15)
 c.request(method,path,body,{'Authorization':'Bearer '+auth,'apikey':local_env['ANON_KEY'],'Content-Type':ctype})
 r=c.getresponse();data=r.read();c.close();return r.status,data
png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6DjIAAAAASUVORK5CYII=')
owner,pet=str(uuid.uuid4()),str(uuid.uuid4());jwt=token(owner)
other_owner,other_pet=str(uuid.uuid4()),str(uuid.uuid4())
sql(f"insert into auth.users(id,email) values('{owner}','{owner}@storage-http.test');insert into public.pets(id,owner_id,name,species) values('{pet}','{owner}','Storage HTTP','dog');")
paths=[]
legacy_paths=[]
def prepare():
 mutation,asset=str(uuid.uuid4()),str(uuid.uuid4())
 media=json.dumps([dict(asset_id=asset,content_type='image/png',byte_size=len(png),position=0)])
 out=sql(f"begin;set local role authenticated;select set_config('request.jwt.claim.sub','{owner}',true);select public.prepare_memory('{mutation}','HTTP',current_date,now(),array['{pet}'::uuid],'{media}');commit;")
 data=next(json.loads(line) for line in out.splitlines() if line.startswith('{'))
 paths.append(data['media'][0]['storage_path']);return data
try:
 normal=prepare();path=normal['media'][0]['storage_path']
 status,data=req('POST','/storage/v1/object/memory-media/'+path,png,jwt,'image/png')
 if status not in(200,201):raise AssertionError(f'normal upload {status}: {data.decode()}')
 sql(f"begin;set local role authenticated;select set_config('request.jwt.claim.sub','{owner}',true);select public.publish_memory('{normal['memory_id']}',1);commit;")
 print('normal actual Storage HTTP upload -> deferred commit validation -> publish passed')
 # Account rehome uses a pre-copy intent; rollback may remove it before a late copy completes.
 job=sql(f"select public.begin_account_deletion_v1('{owner}')->>'job_id';")
 destination=normal['memory_id']+'/'+job+'/'+str(uuid.uuid4());paths.append(destination)
 sql(f"select public.prepare_account_deletion_memory_rehome_v2('{owner}','{normal['media'][0]['id']}','{path}','{destination}');")
 status,data=req('POST','/storage/v1/object/copy',json.dumps(dict(bucketId='memory-media',sourceKey=path,destinationKey=destination)).encode(),local_env['SERVICE_KEY'])
 if status not in(200,201):raise AssertionError(f'ownerless copy {status}: {data.decode()}')
 sql(f"select public.rehome_account_deletion_memory_v2('{owner}','{normal['media'][0]['id']}','{path}','{destination}');select public.rollback_account_deletion_memory_v2('{owner}','{normal['media'][0]['id']}');")
 status,data=req('DELETE','/storage/v1/object/memory-media',json.dumps({'prefixes':[destination]}).encode(),local_env['SERVICE_KEY'])
 if status not in(200,201):raise AssertionError('rollback copy cleanup failed')
 print('actual ownerless HTTP account copy -> finalize -> rollback preserved original')
 latecopy=normal['memory_id']+'/'+job+'/'+str(uuid.uuid4());paths.append(latecopy)
 sql(f"select public.prepare_account_deletion_memory_rehome_v2('{owner}','{normal['media'][0]['id']}','{path}','{latecopy}');select public.rollback_account_deletion_memory_v2('{owner}','{normal['media'][0]['id']}');")
 status,data=req('POST','/storage/v1/object/copy',json.dumps(dict(bucketId='memory-media',sourceKey=path,destinationKey=latecopy)).encode(),local_env['SERVICE_KEY'])
 if status in(200,201) or sql(f"select count(*) from storage.objects where bucket_id='memory-media' and name='{latecopy}';")!='0':raise AssertionError('late ownerless copy survived removed intent')
 sql(f"select public.cancel_account_deletion_v1('{owner}');")
 print(f'intent rollback before copy -> late ownerless HTTP copy denied (HTTP {status})')
 # A superuser metadata rewrite of a published object must still fail at commit.
 r=subprocess.run(PSQL,input=f"begin;update storage.objects set metadata=metadata||'{{\"size\":1}}' where bucket_id='memory-media' and name='{path}';commit;",text=True,capture_output=True)
 if r.returncode==0 or 'resource_storage_access_denied' not in r.stderr:raise AssertionError('published overwrite was not blocked: '+r.stderr)
 print('published Storage UPDATE denied despite service/superuser RLS bypass')
 delayed=prepare();latepath=delayed['media'][0]['storage_path']
 c=http.client.HTTPConnection('127.0.0.1',54321,timeout=15)
 c.putrequest('POST','/storage/v1/object/memory-media/'+latepath)
 for k,v in {'Authorization':'Bearer '+jwt,'apikey':local_env['ANON_KEY'],'Content-Type':'image/png','Transfer-Encoding':'chunked'}.items():c.putheader(k,v)
 c.endheaders();first=png[:16];c.send(f'{len(first):x}\r\n'.encode()+first+b'\r\n')
 time.sleep(.5)
 # No early HTTP rejection: request passed prepareUpload and awaits the remaining body.
 c.sock.settimeout(.2)
 try:
  early=c.sock.recv(1,socket.MSG_PEEK)
  if early:raise AssertionError('upload rejected before delayed completion')
 except socket.timeout:pass
 c.sock.settimeout(15)
 sql(f"begin;set local role authenticated;select set_config('request.jwt.claim.sub','{owner}',true);select public.delete_memory('{delayed['memory_id']}',1);commit;select public.complete_resource_cleanup_v1('memory-media','{latepath}');")
 rest=png[16:];c.send(f'{len(rest):x}\r\n'.encode()+rest+b'\r\n0\r\n\r\n')
 r=c.getresponse();data=r.read();status=r.status;c.close()
 if status in(200,201):raise AssertionError('late upload resurrected deleted memory object')
 state=sql(f"select count(*) from storage.objects where bucket_id='memory-media' and name='{latepath}';")
 if state!='0':raise AssertionError('late Storage object survived without reservation')
 print(f'chunked upload preflight -> delete -> cleanup ACK -> late complete denied (HTTP {status}), no orphan row')
 # Legacy preflight and actual completion use separate transactions as well.
 legacy=f'{pet}/profile/{uuid.uuid4()}';legacy_paths.append(legacy)
 status,data=req('POST','/storage/v1/object/pet-media/'+legacy,png,jwt,'image/png')
 if status not in(200,201):raise AssertionError(f'legacy completion-first upload {status}: {data.decode()}')
 sql(f"select public.begin_account_deletion_v1('{owner}');")
 if sql(f"select public.account_deletion_storage_state_v1('{owner}')->>'user_owned_count';")=='0':raise AssertionError('begin deletion missed committed legacy object')
 sql(f"select public.cancel_account_deletion_v1('{owner}');")
 print('legacy actual completion -> account begin inventories committed object')
 legacy=f'{pet}/profile/{uuid.uuid4()}';legacy_paths.append(legacy)
 c=http.client.HTTPConnection('127.0.0.1',54321,timeout=15)
 c.putrequest('POST','/storage/v1/object/pet-media/'+legacy)
 for k,v in {'Authorization':'Bearer '+jwt,'apikey':local_env['ANON_KEY'],'Content-Type':'image/png','Transfer-Encoding':'chunked'}.items():c.putheader(k,v)
 c.endheaders();first=png[:16];c.send(f'{len(first):x}\r\n'.encode()+first+b'\r\n');time.sleep(.5)
 c.sock.settimeout(.2)
 try:
  if c.sock.recv(1,socket.MSG_PEEK):raise AssertionError('legacy rejected before delayed completion')
 except socket.timeout:pass
 c.sock.settimeout(15)
 sql(f"select public.begin_account_deletion_v1('{owner}');")
 rest=png[16:];c.send(f'{len(rest):x}\r\n'.encode()+rest+b'\r\n0\r\n\r\n')
 r=c.getresponse();status=r.status;data=r.read();c.close()
 if status in(200,201) or sql(f"select count(*) from storage.objects where bucket_id='pet-media' and name='{legacy}';")!='0':raise AssertionError('late legacy completion survived account deletion')
 sql(f"select public.cancel_account_deletion_v1('{owner}');")
 print(f'legacy preflight -> account begin -> actual completion rejected (HTTP {status}), no orphan')
 def gate_holder(target_pet=pet):
  proc=subprocess.Popen(PSQL,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
  proc.stdin.write(f"begin;update public.pets set name='HTTP gate holder' where id='{target_pet}';\n\\echo GATE_READY\n");proc.stdin.flush()
  while True:
   line=proc.stdout.readline()
   if 'GATE_READY' in line:return proc
   if not line:raise AssertionError(proc.stderr.read())
 def release_gate(proc):
  proc.stdin.write('commit;\n\\q\n');proc.stdin.flush();proc.wait(timeout=10)
  if proc.returncode:raise AssertionError(proc.stderr.read())
 def delete_object(path,bulk):
  if bulk:return req('DELETE','/storage/v1/object/pet-media',json.dumps({'prefixes':[path]}).encode(),local_env['SERVICE_KEY'])
  return req('DELETE','/storage/v1/object/pet-media/'+path,b'{}',local_env['SERVICE_KEY'])
 def check_http(result,label,allowed):
  status,data=result
  if status==400 and 404 in allowed and json.loads(data).get('statusCode')=='404':status=404
  if status not in allowed or b'40P01' in data:raise AssertionError(f'{label}: {status} {data.decode()}')
 sql(f"insert into auth.users(id,email) values('{other_owner}','{other_owner}@unrelated-http.test');insert into public.pets(id,owner_id,name,species) values('{other_pet}','{other_owner}','Other HTTP pet','dog');")
 independent=prepare();holder=gate_holder(other_pet)
 try:
  started=time.monotonic()
  check_http(req('POST','/storage/v1/object/memory-media/'+independent['media'][0]['storage_path'],png,jwt,'image/png'),'unrelated-pet upload completion',[200,201])
  if time.monotonic()-started>=1.5:raise AssertionError('unrelated-pet actual completion exceeded 1500ms')
 finally:release_gate(holder)
 print('unrelated pet profile transaction did not block actual memory upload completion (under 1500ms)')
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  for bulk_first in [False,True]:
   for repetition in range(3):
    deletion_path=f'{pet}/profile/{uuid.uuid4()}';legacy_paths.append(deletion_path)
    check_http(req('POST','/storage/v1/object/pet-media/'+deletion_path,png,jwt,'image/png'),'delete race fixture',[200,201])
    holder=gate_holder()
    try:
     first=pool.submit(delete_object,deletion_path,bulk_first);time.sleep(.1)
     second=pool.submit(delete_object,deletion_path,not bulk_first)
     # Both deletes must finish while an unrelated app transaction still owns G.
     check_http(first.result(timeout=4),'first actual DELETE',[200,201,404])
     check_http(second.result(timeout=4),'second actual DELETE',[200,201,404])
     if sql(f"select count(*) from storage.objects where bucket_id='pet-media' and name='{deletion_path}';")!='0':raise AssertionError('single/bulk delete retained object')
    finally:release_gate(holder)
 print('6 actual single/bulk DELETE races (both entry orders x3) completed under held app gate: no 500/40P01 and zero objects')
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  reservation=prepare();upload_path=reservation['media'][0]['storage_path']
  futures=[pool.submit(req,'POST','/storage/v1/object/memory-media/'+upload_path,png,jwt,'image/png') for _ in range(2)]
  responses=[future.result(timeout=15) for future in futures]
  if sum(status in(200,201) for status,_ in responses)!=1:raise AssertionError(f'duplicate reserved uploads did not have exactly one success: {responses}')
  for status,data in responses:check_http((status,data),'same reservation upload',[200,201,400,409])
  if sql(f"select count(*) from storage.objects where bucket_id='memory-media' and name='{upload_path}';")!='1':raise AssertionError('duplicate reserved upload object count')
 print('same reserved path concurrent actual uploads: one success, one normal conflict, one object, zero 40P01')
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  for repetition in range(3):
   upload_path=f'{pet}/profile/{uuid.uuid4()}';legacy_paths.append(upload_path)
   holder=gate_holder()
   try:
    upload=pool.submit(req,'POST','/storage/v1/object/pet-media/'+upload_path,png,jwt,'image/png')
    time.sleep(.2)
    removal=pool.submit(delete_object,upload_path,repetition%2==0)
    # App gate never waits for a Storage tuple: deleting during completion is safe.
    check_http(removal.result(timeout=4),'actual upload/DELETE',[200,201,404])
   finally:release_gate(holder)
   check_http(upload.result(timeout=15),'actual upload completion',[200,201,400,409])
   if sql(f"select count(*)<=1 from storage.objects where bucket_id='pet-media' and name='{upload_path}';")!='t':raise AssertionError('upload/delete duplicate objects')
 print('3 actual upload-completion/DELETE races under app gate: normal outcome, zero 500/40P01, at most one object')


finally:
 sql(f"delete from public.pets where id in('{pet}','{other_pet}');delete from auth.users where id in('{owner}','{other_owner}');")
 if legacy_paths:
  status,data=req('DELETE','/storage/v1/object/pet-media',json.dumps({'prefixes':legacy_paths}).encode(),local_env['SERVICE_KEY'])
  if status not in(200,201):raise AssertionError(f'legacy HTTP cleanup failed {status}: {data.decode()}')
 # Cleanup via local Storage API only; ACK queue rows only after API removal succeeds.
 if paths:
  status,data=req('DELETE','/storage/v1/object/memory-media',json.dumps({'prefixes':paths}).encode(),local_env['SERVICE_KEY'])
  if status not in(200,201):raise AssertionError(f'HTTP fixture cleanup failed {status}: {data.decode()}')
  for path in paths:sql(f"select public.complete_resource_cleanup_v1('memory-media','{path}');")
PY
