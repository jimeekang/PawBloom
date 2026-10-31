import { bindWebMotion } from './webMotionBinding';
import { createAnimatedTestHarness } from './animatedTestHarness';
declare const require:(name:string)=>any;
const modules=require('node:module'),original=modules._load,a=createAnimatedTestHarness();
modules._load=function(name:string,parent:unknown,main:boolean){if(name==='react-native')return{Animated:a.Animated};return original.call(this,name,parent,main);};
try {
  const {characterFrameOpacities,isCharacterNight,nextCharacterClockBoundary}=require('./characterClipMotion');
  for(const count of [1,2,3,4]){
    const raw=new a.Animated.Value(0),opacity=characterFrameOpacities(raw,count);
    const points=count===1?[0,.5,1]:[...Array.from({length:count},(_,i)=>[i,i+.01,i+.5,i+.99]).flat(),count];
    for(const at of points){raw.setValue(at);const values=opacity.map((v:any)=>typeof v==='number'?v:v.__getValue()),index=Math.min(count-1,Math.floor(at));assert(values.every((v:number,i:number)=>Math.abs(v-(i===index?1:0))<1e-12),`N${count}@${at}: exact one-hot interval, terminal clamp`);}
  }
  const raw=new a.Animated.Value(0),opacities=characterFrameOpacities(raw,4),targets=opacities.map(()=>({style:{opacity:'',transform:''}}));
  const unbind=targets.map((target:any,i:number)=>bindWebMotion(target,{opacity:opacities[i]},[raw]));
  for(const frame of [0,.5,.99,1,1.5,2.99,3.5,4]){raw.setValue(frame);assert(targets.every((target:any,i:number)=>Math.abs(Number(target.style.opacity)-(i===Math.min(3,Math.floor(frame))?1:0))<1e-12),'web raw listener resolves derived native-style graph without React');}
  unbind.forEach((fn:()=>void)=>fn());assert(raw.listeners.size===0,'web frame subscriptions release on unmount');
  assert(isCharacterNight(new Date(2026,9,30,22))&&!isCharacterNight(new Date(2026,9,30,6)),'local night bounds 22 inclusive / 06 exclusive');
  assert(nextCharacterClockBoundary(new Date(2026,9,30,21,59,59))===1000,'night boundary exact');
  assert(nextCharacterClockBoundary(new Date(2026,9,31,5,59,59))===1000,'morning boundary exact');
}finally{modules._load=original;}
function assert(value:unknown,message:string):asserts value{if(!value)throw new Error(message);}
