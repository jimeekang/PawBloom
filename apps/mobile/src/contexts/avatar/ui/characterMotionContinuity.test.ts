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
  const controller=createCharacterMotionController(values,()=>undefined);
  const base={id:'continuity',enabled:true,paused:false,reduced:false,tap:0,saved:0,lifted:false,reveal:false};
  const config={species:'cat',clock:animated.clock,active:true};
  const on=(value:any,kind?:string)=>animated.animations.filter(a=>a.value===value&&(!kind||a.kind===kind));
  animated.setDate(new Date(2026,9,30,14,0,0));
  controller.update({...base},config);
  // Pick up: one spring to 1 with v2 constants.
  controller.update({...base,paused:true,lifted:true},config);
  const up=on(values.lift,'spring').pop()!;
  assert(up.running&&up.options.toValue===1&&up.options.friction===6&&up.options.tension===120,'pick-up springs the lift to 1');
  values.lift.setValue(.7);
  // Unrelated change while lifted (a tap count bump) keeps the same spring and value.
  controller.update({...base,paused:true,lifted:true,tap:1},config);
  assert(up.running&&on(values.lift,'spring').length===1&&values.lift.__getValue()===.7,'unrelated option change does not restart or snap the lift');
  // Drop: spring back to 0 instead of snapping.
  controller.update({...base,paused:true,lifted:false,tap:1},config);
  const down=on(values.lift,'spring').pop()!;
  assert(!up.running&&down.running&&down.options.toValue===0&&down.options.friction===6&&down.options.tension===120&&values.lift.__getValue()===.7,'release springs the lift down from where it is');
  // A fade in progress survives an unrelated gate change; opacity is not reset to 1.
  controller.update({...base,tap:2},config);
  const dip=animated.animations.filter(a=>a.kind==='sequence').pop()!;
  values.opacity.setValue(.8);
  controller.update({...base,tap:2,paused:true},config);
  assert(dip.running&&values.opacity.__getValue()===.8,'pausing mid tap-dip keeps the opacity animation and value');
  // Wander eases home when paused instead of jumping to 0.
  values.wander.setValue(12);
  controller.update({...base,tap:2,paused:false},config); controller.update({...base,tap:2,paused:true},config);
  const home=on(values.wander,'timing').pop()!;
  assert(values.wander.__getValue()===12&&home.running&&home.options.toValue===0&&home.options.duration===200,'pause eases wander home over 200ms, no snap');
  // Reduced motion: reveal has no fade, opacity is simply 1; travel and lift are still.
  values.opacity.setValue(.4);
  const before=on(values.opacity).length;
  controller.update({...base,reduced:true,reveal:true},config);
  assert(values.opacity.__getValue()===1&&on(values.opacity).length===before,'reduced reveal sets opacity to 1 without a fade');
  assert(values.wander.__getValue()===0&&values.lift.__getValue()===0,'reduced motion holds wander and lift at rest');
  // Background is still a hard stop.
  values.wander.setValue(5); controller.update({...base},{...config,active:false});
  assert(!animated.animations.some(a=>a.running)&&values.wander.__getValue()===0&&values.opacity.__getValue()===1,'inactive app stops everything and resets');
  // A tap while walking left: the reaction faces forward, then the walk resumes from home.
  const facing={frame:new A.Value(0),wander:new A.Value(0),direction:new A.Value(1),lift:new A.Value(0),opacity:new A.Value(1)};
  let latest='sit';const walker=createCharacterMotionController(facing,(pose:string)=>{latest=pose;});
  // Read through a function: assertions must not let TypeScript narrow the observed pose to a literal.
  const shown=()=>latest;
  animated.setDate(new Date(2026,9,30,14,0,0));walker.update({...base,id:'left-walker'},config);
  for(let i=0;i<20000&&facing.direction.__getValue()!==-1;i+=50)animated.advance(50);
  assert(facing.direction.__getValue()===-1&&shown()==='walkRight','fixture reaches the leftward walk step');
  walker.update({...base,id:'left-walker',tap:1},config);
  assert(shown()==='wave'&&facing.direction.__getValue()===1,'a tap mid left-walk waves facing forward, not mirrored');
  const {characterReactionDuration}=require('./characterMotionController'),wave=characterReactionDuration('cat','wave');
  animated.advance(wave/2);walker.update({...base,id:'left-walker',tap:1,paused:true},config);
  assert(shown()==='wave'&&facing.direction.__getValue()===1,'a gate change mid-reaction stays forward-facing');
  walker.update({...base,id:'left-walker',tap:1},config);
  animated.advance(wave/2+1);
  assert(shown()==='sit'&&facing.direction.__getValue()===1,'reaction end returns to a forward idle');
  let resumed=false;for(let i=0;i<20000&&!resumed;i+=50){animated.advance(50);resumed=shown()==='walkRight';}
  const step=on(facing.wander,'timing').pop()!;
  assert(resumed&&facing.direction.__getValue()===1&&step.running&&step.options.toValue===16,'wander resumes with the first rightward step');
  walker.update({...base,id:'left-walker',tap:1,saved:1},config);
  assert(shown()==='stretch'&&facing.direction.__getValue()===1,'a save reaction mid-walk also faces forward');
  walker.stop();
  console.log('Motion continuity: lift/fade/wander survive unrelated updates; drop springs; reduced reveal is instant.');
} finally { modules._load=original; }
function assert(value:unknown,message:string):asserts value {if(!value)throw new Error(message);}
