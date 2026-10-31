import type { CharacterSpecies } from './appearance';
import type { PixelFrame } from './pixelFrames';

export type PixelEyeRegion = { left:number; top:number; right:number; bottom:number; side:'left'|'right'; kind:'open'|'half'|'closed' };
// Fixed design registrations are independent of actual (possibly damaged) eye pixels.
const registrations: Readonly<Record<string, readonly (readonly number[])[]>> = {
  "sit:0": [[10,15,19,25],[24,15,33,25]],
  "blink:0": [[10,15,19,25],[24,15,33,25]],
  "blink:3": [[10,15,19,25],[24,15,33,25]],
  "wave:0": [[10,14,19,24],[24,14,33,24]],
  "wave:1": [[9,14,18,24],[23,14,32,24]],
  "wave:3": [[9,14,18,24],[23,14,32,24]],
  "walkFront:0": [[16,13,25,23],[30,13,39,23]],
  "walkFront:2": [[16,13,25,23],[30,13,39,23]],
  "walkFront:1": [[17,14,26,24],[31,14,40,24]],
  "walkFront:3": [[17,14,26,24],[31,14,40,24]],
  "jump:0": [[20,17,29,26],[34,17,43,26]],
  "walkRight:0": [[34,22,41,31]],
  "walkRight:1": [[34,22,41,31]],
  "walkRight:2": [[33,22,40,31]],
  "walkRight:3": [[33,22,40,31]],
  "stretch:0": [[33,22,40,31]],
  "stretch:1": [[33,29,40,38]],
  "stretch:3": [[33,22,40,31]],
  "run:0": [[35,27,42,36]],
  "blink:1": [[10,19,19,24],[24,19,33,24]],
  "blink:2": [[10,21,19,23],[24,21,33,23]],
  "sleep:0": [[25,31,28,34],[31,36,36,39]],
  "sleep:1": [[26,31,29,34],[32,36,37,39]],
  "sleep:2": [[26,31,29,34],[32,36,37,39]],
  "sleep:3": [[27,30,31,34],[33,35,39,39]],
  "stretch:2": [[34,33,39,34]],
  "wave:2": [[9,19,18,21],[23,19,32,21]],
};

export function pixelEyeRegions(frame: Pick<PixelFrame,'pose'|'index'>, species: CharacterSpecies='cat'): readonly PixelEyeRegion[] {
  const pose=frame.pose==='walkSide'?'walkRight':frame.pose, key=`${pose}:${frame.index}`;
  let kind: PixelEyeRegion['kind']=pose==='sleep'||pose==='stretch'&&frame.index===2||pose==='wave'&&frame.index===2||pose==='blink'&&frame.index===2?'closed':pose==='blink'&&frame.index===1?'half':'open';
  let boxes=registrations[key]??[];
  if(species==='other'){boxes=[[13,16,21,25],[26,16,34,25]];kind='open';}
  else if(species==='dog'&&(pose==='sit'||pose==='blink')){const top=kind==='half'?20:kind==='closed'?21:16,bottom=25-(kind==='closed'?2:0);boxes=[[11,top,19,bottom],[24,top,32,bottom]];}
  return boxes.map(([left,top,right,bottom],index)=>({left:left!,top:top!,right:right!,bottom:bottom!,side:boxes.length===1?'right':index===0?'left':'right',kind}));
}
export function isPixelEye(regions: readonly PixelEyeRegion[], x:number,y:number) {
  return regions.some(r=>x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom);
}
export function isPixelEyeSlot(slot:string) { return ['i','k','h','eyeLeft','eyeRight'].includes(slot); }

/** White face masks follow the open eye registration through blink and closed phases. */
export function pixelEyeMaskRegions(frame: Pick<PixelFrame,'pose'|'index'>, species: CharacterSpecies='cat'): readonly PixelEyeRegion[] {
  const open = frame.pose==='blink' ? { pose:'sit' as const,index:0 } : frame.pose==='wave' && frame.index===2 ? { pose:'wave' as const,index:1 } : frame;
  return pixelEyeRegions(open,species);
}
