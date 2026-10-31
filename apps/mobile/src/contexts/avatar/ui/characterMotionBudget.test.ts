import { createHookHarness } from '../../../presentation/testHookHarness';
import { createAnimatedTestHarness } from './animatedTestHarness';
declare const require:(name:string)=>any;
const modules=require('node:module'),original=modules._load,react=require('react'),a=createAnimatedTestHarness();
a.setDate(new Date(2026,9,30,23));
let current=createHookHarness();
const hosts: ReturnType<typeof createHookHarness>[]=[];
modules._load=function(name:string,parent:unknown,main:boolean){
  if(name==='react')return{...react,...Object.fromEntries(Object.keys(current.hooks).map(key=>[key,(...args:any[])=>(current.hooks as any)[key](...args)]))};
  if(name==='react-native')return{Platform:{OS:'ios'},Animated:a.Animated,AppState:a.AppState,Easing:{linear:(v:number)=>v}};
  return original.call(this,name,parent,main);
};
try{
  const{useCharacterMotion}=require('./useCharacterMotion');
  const before=a.nodes;
  for(let i=0;i<6;i++){
    current=createHookHarness();hosts.push(current);
    const shared=new a.Animated.Value(0),options={id:`budget-${i}`,enabled:true,paused:true,reduced:false,wanderOffset:shared};
    const result=current.render(()=>useCharacterMotion(options,{species:'cat',clock:a.clock}));
    assert(result.pose==='sleep'&&result.frames.length===4&&result.opacities.length===4,'actual six-hook idle mounts only the four-frame sleep clip');
  }
  assert(a.nodes-before===72,'six actual hooks create 72 numeric Animated objects: clip48 + external values24');
  assert(a.animations.filter(animation=>animation.kind==='loop'&&animation.running).length===6,'one native clip loop per pet');
  assert(a.animations.filter(animation=>animation.kind==='timing').every(animation=>animation.options.useNativeDriver&&animation.options.isInteraction===false),'six-pet idle uses native noninteraction timings');
  console.log('Measured six hook graphs: 72 numeric nodes = clip48 + external Values24 (native style/props allocation requires device measurement).');
}finally{hosts.forEach(host=>host.unmount());modules._load=original;}
function assert(value:unknown,message:string):asserts value{if(!value)throw new Error(message);}
