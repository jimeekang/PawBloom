import { defaultAppearance } from '../domain/appearance';
import { previewAppearance } from './appearanceRepository';
import { buildSamplePets } from '../../pet/ui/samplePets';
declare const require:(name:string)=>any;
const modules=require('node:module'),original=modules._load;
const cache=new Map<string,any>(),requests:any[]=[];
const client={cancelQueries:async()=>undefined,setQueryData:(key:unknown,value:unknown)=>cache.set(JSON.stringify(key),value)};
modules._load=function(name:string,parent:unknown,main:boolean){
  if(name==='@tanstack/react-query')return{useQueryClient:()=>client,useQuery:(options:any)=>{
    requests.push(options);const key=JSON.stringify(options.queryKey);
    if(!cache.has(key)&&options.initialData)cache.set(key,options.initialData());
    const data=cache.get(key);return{data,isPending:data===undefined,isError:false,refetch:async()=>undefined};
  }};
  return original.call(this,name,parent,main);
};
try{
  const{usePetAppearance}=require('./usePetAppearance');
  const pets=buildSamplePets('ko');assert(pets.length===4,'coordinator fixture has four named pets');
  for(const pet of pets){const result=usePetAppearance(null,pet.id,pet.species);assert(!result.loading&&JSON.stringify(result.appearance)===JSON.stringify(previewAppearance(pet.id,pet.species)),'preview cache is synchronously seeded by species and id');assert(JSON.stringify(requests.at(-1).queryKey)===JSON.stringify(['appearance',null,pet.id,pet.species]),'preview key includes null user/id/species');}
  const luna=pets.find(pet=>pet.id==='pet-demo-luna')!,edited={...defaultAppearance(),eyeColor:'odd',furLength:'long',build:'round'};
  await usePetAppearance(null,luna.id,'cat').save(edited);
  assert(usePetAppearance(null,luna.id,'cat').appearance.eyeColor==='odd','rerender never overwrites a preview edit with fixture initialData');
  const pending=usePetAppearance('signed-in',luna.id,'cat');assert(pending.loading&&requests.at(-1).initialData===undefined,'logged-in users wait for saved data; preview seed cannot hide it');
  const savedKey=JSON.stringify(['appearance','signed-in',luna.id,'cat']);cache.set(savedKey,edited);
  const loaded=usePetAppearance('signed-in',luna.id,'cat').appearance;
  assert(loaded.version===1&&loaded.furLength==='long'&&loaded.build==='round'&&loaded.eyeColor==='odd','saved v2 payload is returned unchanged');
}finally{modules._load=original;}
function assert(value:unknown,message:string):asserts value{if(!value)throw new Error(message);}
