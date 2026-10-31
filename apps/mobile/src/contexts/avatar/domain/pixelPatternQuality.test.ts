import { isPixelEye, pixelEyeRegions, type PixelEyeRegion } from './pixelEyes';
import { defaultAppearance, presetAppearances, randomAppearance } from './appearance';
import { getPixelClip, pixelPoses, type PixelFrame } from './pixelFrames';
import { appearancePixelMasks, coatPixelMask, composePixelFrame, dogBicolorPixelMask } from './pixelMasks';
import { blockPixel, cleanPatternPaint, joinedPixel } from './pixelPatternCleanup';
const directions = [[1,0],[-1,0],[0,1],[0,-1]];
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function noSingletons(rows: readonly (readonly string[] | string)[], slots: readonly string[], id: string, eyes: readonly PixelEyeRegion[] = []) {
  rows.forEach((row,y) => [...row].forEach((c,x) => {
    if (!isPixelEye(eyes,x,y) && slots.includes(c)) assert(directions.some(([dx,dy]) => rows[y+dy!]?.[x+dx!] === c), `${id}: isolated ${c} at ${x},${y}`);
  }));
}
function noWhiteHoles(rows: readonly (readonly string[])[], id: string, eyes: readonly PixelEyeRegion[] = [], whiteCoat = false) {
  const white=(c:string|undefined)=>c==='w'||c==='W'||whiteCoat&&(c==='b'||c==='s');
  rows.forEach((row,y)=>row.forEach((c,x)=>{
    if (!isPixelEye(eyes,x,y) && white(c)) assert(directions.some(([dx,dy])=>white(rows[y+dy!]?.[x+dx!])), `${id}: isolated white-family hole at ${x},${y}`);
  }));
}
function rejects(rows: readonly (readonly string[] | string)[], slots: readonly string[], id: string, eyes: readonly PixelEyeRegion[] = []) {
  let failed = false;
  try { noSingletons(rows,slots,id); } catch (error) { failed = String(error).includes('isolated'); }
  assert(failed, `${id}: defective fixture must fail`);
}
for (const species of ['cat','dog','other'] as const) {
  const poses = species === 'cat' ? pixelPoses : species === 'dog' ? ['sit','blink','walkSide','sleep'] as const : ['sit'] as const;
  for (const pose of poses) for (const f of getPixelClip(species,pose)) {
    const id = `${species}/${pose}:${f.index}`, eyes=pixelEyeRegions(f,species);
    noSingletons(f.rows,['t','w'],id,eyes);
    for (const pattern of ['calico','bicolor','pointed'] as const) {
      if (pattern !== 'pointed') {
        noSingletons(coatPixelMask(f,pattern,'rows',species).rows,['x'],`${id}/${pattern} mask`,eyes);
        if (pattern === 'calico') noSingletons(coatPixelMask(f,pattern,'black',species).rows,['x'],`${id}/black mask`,eyes);
      } else noSingletons(appearancePixelMasks(f,species).pointed.rows,['x'],`${id}/pointed mask`,eyes);
      if (species === 'dog') noSingletons(dogBicolorPixelMask(f).rows,['x'],`${id}/dog mask`,eyes);
      for (const collar of ['none','red'] as const) {
        const g = composePixelFrame(f,{...defaultAppearance(species),coatPattern:pattern,collar},species);
        noSingletons(g,['t','w','ginger','black'],`${id}/${pattern}/${collar}`,eyes);
        if (pattern === 'calico') noWhiteHoles(g,`${id}/${pattern}/${collar}`,eyes);
        if (pattern === 'calico') g.forEach((row,y) => row.forEach((c,x) => {
          if (!isPixelEye(eyes,x,y) && (c === 'ginger' || c === 'black')) assert(blockPixel(g,x,y,c), `${id}: patch must belong to 2x2 block`);
          if (!isPixelEye(eyes,x,y) && c === 'w' && !joinedPixel(g,x,y,'w')) assert(!['ginger','black'].some(p => directions.filter(([dx,dy]) => g[y+dy!]?.[x+dx!] === p).length >= 3), `${id}: no isolated white hole inside a coat patch`);
        }));
      }
    }
  }
}
// Body and tail defects fail; intended eye boxes are checked by the independent eye validator.
const good = getPixelClip('cat','sit')[0]!;
for (const [x,y] of [[24,34],[39,33]]) {
  const rows = good.rows.map(row => [...row]);
  for (const [dx,dy] of directions) rows[y!+dy!]![x!+dx!] = 'b';
  rows[y!]![x!] = 'w'; rejects(rows,['w'],`white fixture ${x},${y}`);
}
for (const c of ['t','x','ginger','black']) {
  const rows = Array.from({length:48},()=>Array(48).fill('.'));
  rows[24]![24] = c; rejects(rows,[c],`${c} fixture`);
}
const hole = Array.from({length:5},()=>Array(5).fill('ginger'));
hole[2]![2] = 'w';
rejects(hole,['w'],'calico white hole fixture');
assert(cleanPatternPaint(hole,true)[2]![2] === 'ginger', 'calico interior white hole is filled by the surrounding patch, not erased to white');
for (const pose of ['sit','blink'] as const) for (const f of getPixelClip('dog',pose)) {
  const [cx,ny] = pose === 'blink' && f.index === 3 ? [21,23] : pose === 'blink' && (f.index === 1 || f.index === 2) ? [21,23] : [21,24];
  const nose = f.rows.flatMap((row,y) => [...row].flatMap((c,x) => c === 'n' ? [[x,y]] : []));
  assert(nose.length === 2 && nose.every(([x,y]) => y === ny && (x === cx || x === cx!+1)), `dog ${pose}:${f.index}: centered 2px nose`);
  assert(f.rows[ny!]![cx!-1] === 'w' && f.rows[ny!]![cx!+2] === 'w', `dog ${pose}:${f.index}: nose lies inside white muzzle`);
  assert(f.rows.slice(15,29).every(row=>!row.slice(9,33).includes('e')), `dog ${pose}:${f.index}: no pink ear slot floating over facial features`);
  if (pose==='blink' && f.index===2) assert(ny!>22, 'closed blink nose is below both eye arcs at rows21..22');
  assert(f.rows[ny!+1]![cx!] === 'm' && f.rows[ny!+1]![cx!+1] === 'm' && f.rows[ny!+2]![cx!-1] === 'm' && f.rows[ny!+2]![cx!+2] === 'm', `dog ${pose}:${f.index}: symmetric mouth`);
}
for (const species of ['cat','dog'] as const) for (const f of getPixelClip(species,'blink').slice(1,3)) {
  for (let y=16; y<=(f.index===1?18:21); y++) for (let x=9; x<=33; x++) assert(isPixelEye(pixelEyeRegions(f,species),x,y) || !/[wW]/.test(f.rows[y]![x]!), `${species}/blink:${f.index}: no pale brow band`);
  assert(f.rows.slice(19,24).some(row=>row.includes('kk')), 'blink retains actual dark eye arcs');
}
for (const f of getPixelClip('dog','sleep')) {
  for (let y=20;y<38;y++) for (let x=0;x<38;x++) assert(isPixelEye(pixelEyeRegions(f,'dog'),x,y) || !/[wW]/.test(f.rows[y]![x]!), `sleep:${f.index}: no body/ear white noise`);
  assert(f.rows.slice(32,44).some(row=>row.slice(38).includes('ww')), 'sleep keeps intentional white face and socks');
}
console.log('Pattern quality: all 45 frames and three final coat patterns have no isolated t/w/patch pixels outside fixed eye boxes; 9 negative fixtures including whiteShade alias.');

const pointedFrame = getPixelClip('cat','sit')[0]!;
const pointed = composePixelFrame(pointedFrame,{...defaultAppearance(),coatPattern:'pointed'});
const noseRow = pointedFrame.rows.findIndex(row=>row.includes('n'));
assert(pointed.slice(noseRow-4,noseRow).every(row=>row.slice(20,24).includes('t')), 'pointed accent reaches the central bridge above the nose');
pointedFrame.rows.forEach((row,y)=>[...row].forEach((c,x)=>{
  if (['n','m','i','h'].includes(c) || c==='w' && y>=noseRow) assert(pointed[y]![x] === (c==='i'?x<24?'eyeLeft':'eyeRight':c), 'pointed bridge preserves iris, glints, nose, mouth and lower white muzzle');
}));

for (const [appearanceIndex,appearance] of [presetAppearances('cat')[2]!,randomAppearance('cat',245)].entries()) for (const f of getPixelClip('cat','sleep')) {
  const output=composePixelFrame(f,appearance);
  noWhiteHoles(output,`actual calico preset/random245 sleep:${f.index}`,pixelEyeRegions(f));
  for (const [x,y] of [[27,28],[13,31],[14,32]]) if (f.index===0 && appearanceIndex===0) assert(output[y!]![x!]!=='w'&&output[y!]![x!]!=='W', `reviewer calico sleep hole ${x},${y} is absorbed into coat`);
  output.forEach((row,y)=>row.forEach((c,x)=>{if(c==='ginger'||c==='black')assert(blockPixel(output,x,y,c),'actual calico retains 2x2 patch support');}));
}
const whiteShadeHole=Array.from({length:5},()=>Array(5).fill('black'));
whiteShadeHole[2]![2]='W';
let shadeRejected=false;try{noWhiteHoles(whiteShadeHole,'shade negative');}catch{shadeRejected=true;}
assert(shadeRejected,'a whiteShade alias cannot bypass white-family quality checks');
assert(cleanPatternPaint(whiteShadeHole,true)[2]![2]==='black','whiteShade hole is filled by coat, not another white shade');

// The calico white preset resolves b/s to the same white family as w/W.
for(const appearance of [presetAppearances('cat')[2]!,randomAppearance('cat',245)])for(const earShape of ['pointed','folded','curled'] as const)for(const pose of pixelPoses)for(const frame of getPixelClip('cat',pose)){
  noWhiteHoles(composePixelFrame(frame,{...appearance,earShape}),'calico actual white coat aliases',pixelEyeRegions(frame),appearance.coatColor==='white');
}
const whiteBaseHole=Array.from({length:5},()=>Array(5).fill('black'));whiteBaseHole[2]![2]='b';
let baseRejected=false;try{noWhiteHoles(whiteBaseHole,'actual white base negative',[],true);}catch{baseRejected=true;}
assert(baseRejected,'white-coat b cannot bypass white-family hole checks');
