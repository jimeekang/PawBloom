import { defaultAppearance, type CharacterSpecies } from './appearance';
import { getPixelClip, getPixelFrame, pixelPoses, type PixelFrame } from './pixelFrames';
import { isPixelEye, pixelEyeRegions, type PixelEyeRegion } from './pixelEyes';
import { appearancePixelMasks, composePixelFrame } from './pixelMasks';
import { cleanPatternPaint } from './pixelPatternCleanup';
import { replacePixelSilhouette } from './pixelReplacements';
function assert(value:unknown,message:string): asserts value { if(!value)throw Error(message); }
function fails(fn:()=>void,reason:string){let error='';try{fn();}catch(e){error=String(e);}assert(error.includes(reason),`negative fixture must detect ${reason}: ${error}`);}
function bounds(cells: readonly (readonly [number,number,...unknown[]])[]){assert(cells.length,'visible eye data');return{left:Math.min(...cells.map(c=>c[0]!)),right:Math.max(...cells.map(c=>c[0]!)),top:Math.min(...cells.map(c=>c[1]!)),bottom:Math.max(...cells.map(c=>c[1]!))};}
function wholeEyeBounds(grid: readonly (readonly string[] | string)[],eye:PixelEyeRegion){
  let seed:[number,number]|undefined;
  for(let y=eye.top;y<=eye.bottom;y++)for(let x=eye.left;x<=eye.right;x++)if(grid[y]![x]==='h')seed=[x,y];
  if(!seed)for(let y=eye.top;y<=eye.bottom;y++)for(let x=eye.left;x<=eye.right;x++)if(grid[y]![x]==='k')seed=[x,y];
  assert(seed,'whole-grid eye measurement needs a mint/pupil seed');
  const queue=[seed],seen=new Set<string>(),points:[number,number][]=[];
  for(let at=0;at<queue.length;at++){
    const[x,y]=queue[at]!,key=`${x},${y}`;
    if(seen.has(key)||!['i','k','h','o','m','eyeLeft','eyeRight'].includes(grid[y]?.[x]??'.'))continue;
    seen.add(key);points.push([x,y]);for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])queue.push([x+dx!,y+dy!]);
  }
  const actual=bounds(points);
  assert(['left','top','right','bottom'].every(k=>actual[k as keyof typeof actual]===eye[k as keyof typeof actual]),'whole-grid visible eye boundary includes an attached face/outline pixel');
  return actual;
}
// Expected stamps are independent of the source literals; G/h is mint, H/w is white.
const frontStamp = ['..kkkkkk..','.kkkkkkkk.','kkGGHkkkkk','kkGGkkkkkk','kkkkkkkkkk','kkkkkkkkkk','kkkkkkkkkk','kikkkkkkik','kiikkkkiik','.kiiiiiik.','..kkkkkk..'];
const dogStamp = ['..kkkkk..','.kkkkkkk.','kkGGHkkkk','kkGGkkkkk','kkkkkkkkk','kkkkkkkkk','kikkkkkik','kiikkkiik','.kiiiiik.','..kkkkk..'];
const sideStamp = ['.kkkkkk.','kkkkkkkk','kGGHkkkk','kGGkkkkk','kkkkkkkk','kkkkkkkk','kikkkkik','kiikkiik','.kiiiik.','..kkkk..'];
function expectedStamp(frame:PixelFrame,eye:PixelEyeRegion) {
  const width=eye.right-eye.left+1;
  const open=width===8?sideStamp:width===9?dogStamp:frame.pose==='jump'?frontStamp.slice(0,10):frontStamp;
  return eye.kind==='half'?['k'.repeat(width),...open.slice(5,10)]:open;
}
function validateEye(frame:PixelFrame,eye:PixelEyeRegion){
  const id=`${frame.pose}:${frame.index}/${eye.side}`,cells:[number,number,string][]=[];
  for(let y=eye.top;y<=eye.bottom;y++)for(let x=eye.left;x<=eye.right;x++)cells.push([x,y,frame.rows[y]![x]!]);
  const actual=bounds(cells.filter(([, ,c])=>eye.kind==='closed'?/[ko]/.test(c):/[ikh]/.test(c)));
  assert(actual.left===eye.left&&actual.right===eye.right&&actual.top===eye.top&&actual.bottom===eye.bottom,`${id}: actual eye extent matches registration`);
  if(eye.kind==='closed'){assert(!cells.some(([, ,c])=>c==='i'||c==='h'),`${id}: closed eye has no iris/glint`);return;}
  for(let y=eye.top-1;y<=eye.bottom+1;y++)for(let x=eye.left-1;x<=eye.right+1;x++)if(!isPixelEye([eye],x,y))assert(!/[ikh]/.test(frame.rows[y]?.[x]??'.'),`${id}: bbox+1 halo restores face instead of old eye border`);
  const stamp=expectedStamp(frame,eye);
  assert(stamp.length===eye.bottom-eye.top+1&&stamp.every(row=>row.length===eye.right-eye.left+1),`${id}: fixed stamp dimensions`);
  stamp.forEach((row,y)=>[...row].forEach((c,x)=>{
    if(c!=='.')assert(frame.rows[eye.top+y]![eye.left+x]===(c==='G'?'h':c==='H'?'w':c),`${id}: exact P1d stamp at ${x},${y}`);
    else assert(!/[ikh]/.test(frame.rows[eye.top+y]![eye.left+x]!),`${id}: stamp corners retain face rather than an old eye border`);
  }));
  if(eye.kind==='half'){
    wholeEyeBounds(frame.rows,eye);
    assert(!cells.some(([, ,c])=>c==='h'),`${id}: half eye has no glint`);
    assert(frame.rows[eye.top]!.slice(eye.left,eye.right+1)==='k'.repeat(eye.right-eye.left+1),`${id}: half eyelid is row5`);
    return;
  }
  wholeEyeBounds(frame.rows,eye);
  const source=stamp.join(''),dark=[...source].filter(c=>c==='k').length;
  assert(dark/source.length>=.6,`${id}: dark pupil covers at least60percent of stamp bbox`);
  assert(stamp.slice(0,Math.ceil(stamp.length/2)).every(row=>!row.includes('i')),`${id}: upper half has no iris`);
  const h=cells.filter(([, ,c])=>c==='h'),hb=bounds(h);
  assert(h.length===4&&hb.right-hb.left===1&&hb.bottom-hb.top===1,`${id}: mint2x2`);
  assert(frame.rows[hb.top]![hb.right+1]==='w',`${id}: white1 glint adjoining mint upper-right`);
  for(const[x,y,c]of cells)if(c==='h'||c==='w'&&x===hb.right+1&&y===hb.top)for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])assert(['k','h','w'].includes(frame.rows[y+dy!]?.[x+dx!]??'.'),`${id}: glint is surrounded by dark pupil`);
}

let checked=0;
for(const species of ['cat','dog','other'] as const){
  const poses=species==='cat'?pixelPoses:species==='dog'?['sit','blink','walkSide','sleep'] as const:['sit'] as const;
  for(const pose of poses)for(const frame of getPixelClip(species,pose)){
    const eyes=pixelEyeRegions(frame,species);
    frame.rows.forEach((row,y)=>[...row].forEach((c,x)=>{if(c==='i'||c==='h')assert(isPixelEye(eyes,x,y),`${species}/${pose}:${frame.index}: iris/glint outside intended eye registration`);}));
    eyes.forEach(eye=>{validateEye(frame,eye);checked++;});
    if(eyes.length===2&&pose!=='sleep'){const[a,b]=eyes;assert(b!.left-a!.right-1===4,`${species}/${pose}:${frame.index}: front eye gap is exactly4 pixels`);assert(a!.right-a!.left===b!.right-b!.left&&a!.bottom-a!.top===b!.bottom-b!.top&&a!.top===b!.top,`${species}/${pose}:${frame.index}: paired eye bbox sizes and height match`);}
    for(const coatPattern of ['solid','bicolor','calico','pointed'] as const)for(const earShape of ['pointed','folded','curled'] as const){
      const appearance={...defaultAppearance(species),coatPattern,earShape,collar:'red' as const,eyeColor:'odd' as const};
      const shaped=replacePixelSilhouette(frame,appearance,species),painted=composePixelFrame(frame,appearance,species);
      for(const eye of eyes)if(eye.kind!=='closed'){wholeEyeBounds(shaped.rows,eye);wholeEyeBounds(painted,eye);}
      for(const eye of eyes)for(let y=eye.top;y<=eye.bottom;y++)for(let x=eye.left;x<=eye.right;x++){
        const original=frame.rows[y]![x]!;
        assert(shaped.rows[y]![x]===original,`${species}/${pose}:${frame.index}: silhouette preserves complete eye bbox`);
        assert(painted[y]![x]===(original==='i'?eye.side==='left'?'eyeLeft':'eyeRight':original),`${species}/${pose}:${frame.index}/${coatPattern}: compose preserves complete eye bbox`);
      }
    }
    if(eyes.length===2&&['sit','blink','wave','walkFront'].includes(pose)){
      const anatomical=pixelEyeRegions(pose==='blink'?{pose:'sit',index:0}:pose==='wave'&&frame.index===2?{pose:'wave',index:1}:frame,species);
      const[a,b]=anatomical,top=Math.min(a!.top,b!.top)-1,bottom=Math.max(a!.bottom,b!.bottom)+1;
      const mask=appearancePixelMasks(frame,species).maskedEyes;
      frame.rows.forEach((row,y)=>[...row].forEach((c,x)=>{
        const around=anatomical.some(e=>x>=e.left-1&&x<=e.right+1&&y>=e.top-1&&y<=e.bottom+1);
        const bridge=x>a!.right&&x<b!.left&&y>=top&&y<=bottom;
        assert(mask.rows[y]![x]===('bst'.includes(c)&&(around||bridge)?'x':'.'),`${species}/${pose}:${frame.index}: maskedEyes is open bbox+1 and bridge through all phases`);
      }));
    }
    const markedAppearance={...defaultAppearance(species),faceMark:'maskedEyes' as const};
    const marked=composePixelFrame(frame,markedAppearance,species),mark=appearancePixelMasks(frame,species).maskedEyes;
    for(const eye of eyes)for(let y=eye.top;y<=eye.bottom;y++)for(let x=eye.left;x<=eye.right;x++){
      const c=frame.rows[y]![x]!,corner=['b','s','t'].includes(c)&&mark.rows[y]![x]==='x';
      assert(marked[y]![x]===(corner?'w':c==='i'?eye.side==='left'?'eyeLeft':'eyeRight':c),`${species}/${pose}:${frame.index}: maskedEyes changes only intended coat corners`);
    }
    if(eyes.length===2&&['sit','blink','wave','walkFront'].includes(pose)){
      const [left,right]=eyes,mid=Math.round((left!.right+right!.left)/2),y=Math.round((left!.top+left!.bottom)/2);
      assert(marked.slice(left!.top,left!.bottom+1).some(row=>['w','W'].includes(row[mid]!)),`${species}/${pose}:${frame.index}: eye mask crosses the bridge instead of detached side bars`);
    }
    for(const earShape of ['pointed','folded','curled'] as const){
      const shaped=replacePixelSilhouette(frame,{...defaultAppearance(species),earShape},species);
      shaped.rows.forEach((row,y)=>[...row].forEach((c,x)=>{if(c==='i'||c==='h')assert(isPixelEye(eyes,x,y),`${species}/${pose}:${frame.index}: shaped iris/glint has no source-cat eye leak`);}));
    }
    if((['sit','blink','wave','walkFront','jump'] as readonly string[]).includes(pose)&&species!=='other'){
      const nose=frame.rows.flatMap((row,y)=>[...row].flatMap((c,x)=>c==='n'?[[x,y]]:[]));
      assert(nose.length===2&&nose[0]![1]===nose[1]![1]&&nose[1]![0]!-nose[0]![0]===1,`${species}/${pose}:${frame.index}: nose is a symmetric 2x1 block`);
      if(eyes.length===2)assert((nose[0]![0]!+nose[1]![0]!)===eyes.reduce((sum,e)=>sum+(e.left+e.right)/2,0),`${species}/${pose}:${frame.index}: nose aligns with the midpoint between eyes`);
    }
  }
}
const good=getPixelFrame('cat'),eye=pixelEyeRegions(good)[0]!;
const edit=(cells: readonly (readonly [number,number,string])[]):PixelFrame=>{const rows=good.rows.map(row=>[...row]);cells.forEach(([x,y,c])=>{rows[y]![x]=c;});return{...good,rows:rows.map(row=>row.join(''))};};
fails(()=>validateEye(edit([[eye.right+1,eye.top-1,'k']]),eye),'bbox+1 halo restores face');
fails(()=>validateEye(edit([[eye.left+4,eye.top+4,'i']]),eye),'exact P1d stamp');
fails(()=>validateEye(edit([[eye.left+3,eye.top+2,'k']]),eye),'exact P1d stamp');
fails(()=>validateEye(edit([[eye.left+1,eye.top+4,'b']]),eye),'exact P1d stamp');
// Protected rectangles include coat/white/transparent corners, not just current eye slots.
const input=Array.from({length:8},()=>Array(8).fill('ginger'));
const protectedEye:PixelEyeRegion={left:2,top:2,right:4,bottom:4,side:'left',kind:'open'};
input[3]![3]='w';input[2]![2]='t';input[4]![4]='.';
const protectedPaint=cleanPatternPaint(input,true,[protectedEye]);
for(let y=2;y<=4;y++)for(let x=2;x<=4;x++)assert(protectedPaint[y]![x]===input[y]![x],'cleanup and absorption cannot touch any intended eye pixel');
for(const slot of ['i','k','h']){const grid=Array.from({length:5},()=>Array(5).fill('ginger'));grid[2]![2]=slot;assert(cleanPatternPaint(grid,true)[2]![2]===slot,'eye slots are globally protected from coat cleanup');}
console.log(`Eye quality: ${checked} fixed eyes, exact P1d stamps, dark pupil60percent, internal mint/white glints, raw/shape/paint protection and one-character negatives.`);

// Dog blink3 moved only the internal hanging-ear boundary, leaving a fur gap beside the eye.
const dogBlink=getPixelFrame('dog','blink',3);
for(const [x,y] of [[33,16],[34,17],[34,18],[34,19],[35,20],[35,21]]) {
  assert(dogBlink.rows[y!]![x!]==='o','moved ear seam remains dark and connected');
  assert(dogBlink.rows[y!]![x!-1]==='b','one-pixel fur separates ear seam and eye');
}
for(const species of ['cat','dog'] as const){
  const open=pixelEyeRegions(getPixelFrame(species,'sit'),species);
  for(const f of getPixelClip(species,'blink')){const eyes=pixelEyeRegions(f,species);assert(eyes.every((e,i)=>e.left===open[i]!.left&&e.right===open[i]!.right),'blink phases share horizontal eye anchors');}
  assert(open.every(e=>e.bottom<26),'full eye remains inside the 26-row avatar crop');
}

for(const [pose,index] of [['sit',0],['blink',0],['blink',3]] as const){
  const cat=pixelEyeRegions(getPixelFrame('cat',pose,index),'cat'),dog=pixelEyeRegions(getPixelFrame('dog',pose,index),'dog');
  cat.forEach((e,i)=>assert(e.right-e.left===dog[i]!.right-dog[i]!.left+1&&e.bottom-e.top===dog[i]!.bottom-dog[i]!.top+1,'dog front eyes are exactly one pixel narrower and shorter than cat eyes'));
}

for(const color of ['k','o','m'])fails(()=>wholeEyeBounds(edit([[eye.right+1,eye.top+4,color]]).rows,eye),'whole-grid visible eye boundary');
