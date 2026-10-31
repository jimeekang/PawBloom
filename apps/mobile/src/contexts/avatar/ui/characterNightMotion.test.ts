import { createAnimatedTestHarness } from './animatedTestHarness';
declare const require: (name:string) => any;
const modules=require('node:module'),original=modules._load;
const animated=createAnimatedTestHarness();
modules._load=function(name:string,parent:unknown,main:boolean) {
  if(name==='react-native') return {Platform:{OS:'ios'},Easing:{linear:(v:number)=>v},Animated:animated.Animated};
  return original.call(this,name,parent,main);
};
try {
  const {createCharacterMotionController}=require('./characterMotionController');
  const A=animated.Animated, values={frame:new A.Value(0),wander:new A.Value(0),direction:new A.Value(1),lift:new A.Value(0),opacity:new A.Value(1)};
  const poses:string[]=[]; const controller=createCharacterMotionController(values,(pose:string)=>poses.push(pose));
  const options={id:'night-cat',enabled:true,paused:false,reduced:false,tap:0,saved:0,lifted:false};
  const config={species:'cat',clock:animated.clock,active:true};
  // Easing home to 0 is not wandering; only travel away from the slot is.
  const wandering=()=>animated.animations.some(a=>a.running&&a.value===values.wander&&a.options?.toValue!==0);
  const walked=()=>poses.includes('walkRight');
  animated.setDate(new Date(2026,9,30,23,0,0)); controller.update({...options},config);
  animated.advance(20000);
  assert(controller.pose==='sleep'&&!walked()&&!wandering()&&values.wander.__getValue()===0,'23:00 plays the sleep clip only and never wanders');
  const sleepLoop=animated.animations.filter(a=>a.kind==='loop'&&a.running);
  assert(sleepLoop.length>0,'night sleep clip keeps looping');
  controller.update({...options,tap:1},config); assert(controller.pose==='wave','a tap still reacts at night');
  animated.advance(700); assert(controller.pose==='sleep'&&!walked(),'after the wave the pet goes back to sleep, not to wandering');
  controller.update({...options,tap:1,saved:1},config); assert(controller.pose==='stretch','a save still reacts at night');
  animated.advance(700); assert(controller.pose==='sleep'&&!walked(),'after the stretch the pet goes back to sleep');
  controller.update({...options,tap:1,saved:1,lifted:true},config); assert(controller.pose==='run','long press still lifts at night');
  controller.update({...options,tap:1,saved:1,lifted:false},config); animated.advance(1000); assert(controller.pose==='sleep'&&!walked(),'dropping the pet returns to sleep');
  controller.update({...options,tap:1,saved:1,reduced:true},config); animated.advance(5000); assert(controller.pose==='sit'&&!wandering(),'reduced motion stays sit at night');
  // Clock crosses 06:00 while the controller is running: the boundary timer restarts daytime wander.
  animated.setDate(new Date(2026,9,31,5,59,0)); controller.update({...options,tap:1,saved:1},config); poses.length=0;
  animated.advance(50000); assert(controller.pose==='sleep'&&!walked(),'05:59:50 is still night');
  animated.advance(20000); assert(walked(),'the 06:00 boundary restarts motion and wander resumes without a remount');
  poses.length=0; animated.setDate(new Date(2026,9,31,7,0,0)); controller.update({...options,tap:1,saved:1},config); animated.advance(4000);
  assert(walked()&&poses.includes('sit'),'07:00 restores daytime sit idle and wander');
  controller.stop(); assert(!animated.animations.some(a=>a.running),'stop clears night and day loops');
  console.log('Night motion: 23:00 sleep only, reactions return to sleep, 07:00 wander resumes.');
} finally { modules._load=original; }
function assert(value:unknown,message:string):asserts value {if(!value)throw new Error(message);}
