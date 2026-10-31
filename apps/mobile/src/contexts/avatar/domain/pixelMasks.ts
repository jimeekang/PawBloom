import { isPixelEye, isPixelEyeSlot, pixelEyeMaskRegions, pixelEyeRegions, type PixelEyeRegion } from './pixelEyes';
import type { Appearance, CharacterSpecies } from './appearance';
import { tracedCoatMasks } from './pixelFrames.baked';
import { replacePixelSilhouette, pixelBounds, pixelDirection, type PixelFrame, type PixelMask, type PixelSlot } from './pixelFrames';

export type PixelPaint = Exclude<PixelSlot, '.'> | 'ginger' | 'black' | 'cream' | 'creamShade' | 'eyeLeft' | 'eyeRight' | 'collar' | 'bell';
export type PixelPaintGrid = readonly (readonly (PixelPaint | '.')[])[];
const coatSlots = new Set(['b', 's', 't']);
const frontPoses = new Set(['sit', 'blink', 'wave', 'walkFront']);
export function emptyPixelMask(frame: PixelFrame): PixelMask { return { pose: frame.pose, index: frame.index, rows: Array(48).fill('.'.repeat(48)) }; }

/** Project real coat-reference masks into a target frame registration. SIDE references face left. */
export function coatPixelMask(frame: PixelFrame, pattern: 'bicolor' | 'calico', patch: 'rows' | 'black' = 'rows', species: CharacterSpecies = 'cat'): PixelMask {
  const direction = pixelDirection(frame.pose);
  const source = tracedCoatMasks[`${pattern}:${direction}` as keyof typeof tracedCoatMasks];
  const sourceRows: readonly string[] = patch === 'black' && 'black' in source ? source.black : source.rows;
  // Masks share their source sprite's 48px registration; use its full reference outline, not patch bbox.
  const sourceBounds = source.bounds;
  const target = pixelBounds(frame.rows);
  const rows = frame.rows.map((row, y) => [...row].map((slot, x) => {
    if (!coatSlots.has(slot)) return '.';
    let u = (x - target.left + .5) / target.width, v = (y - target.top + .5) / target.height;
    if (direction === 'side') u = 1 - u;
    // Curled/stretched faces lie lower than a standing side reference; keep coat on body, not eye features.
    if (frame.pose === 'sleep') v = .22 + v * .78;
    const sx = Math.max(0, Math.min(47, Math.floor(sourceBounds.left + u * sourceBounds.width)));
    const sy = Math.max(0, Math.min(47, Math.floor(sourceBounds.top + v * sourceBounds.height)));
    return sourceRows[sy]?.[sx] === 'x' ? 'x' : '.';
  }).join(''));
  return { pose: frame.pose, index: frame.index, rows: cleanPatternMask(rows, pattern === 'calico', pixelEyeRegions(frame,species)) };
}

/** Minimum dog atlas: one accent ear/eye patch, registered separately for each pose/phase. */
export function dogBicolorPixelMask(frame: PixelFrame): PixelMask {
  const anchors: Partial<Record<PixelFrame['pose'], readonly (readonly [number, number])[]>> = {
    sit: [[11,16]], blink: [[11,16],[11,15],[11,16],[11,15]],
    walkSide: [[33,25],[32,24],[32,24],[32,24]],
    sleep: [[32,31],[32,32],[33,31],[32,31]],
  };
  const [cx,cy] = anchors[frame.pose]?.[frame.index] ?? [11,16];
  const side = pixelDirection(frame.pose) === 'side';
  const result = { pose: frame.pose, index: frame.index, rows: frame.rows.map((row,y) => [...row].map((c,x) => {
    const ellipse = ((x-cx)/9) ** 2 + ((y-cy)/11) ** 2 <= 1;
    return coatSlots.has(c) && ellipse && (side ? x >= 25 && y >= 16 : x < 24) ? 'x' : '.';
  }).join('')) };
  return { ...result, rows: cleanPatternMask(result.rows,false,pixelEyeRegions(frame,'dog')) };
}

export function appearancePixelMasks(frame: PixelFrame, species: CharacterSpecies='cat') {
  const direction = pixelDirection(frame.pose), bounds = pixelBounds(frame.rows);
  const mask = (condition: (x: number, y: number) => boolean, includeWhite = false): PixelMask => ({ pose: frame.pose, index: frame.index, rows: frame.rows.map((row, y) => [...row].map((c, x) => (coatSlots.has(c) || includeWhite && ['w', 'W'].includes(c)) && condition(x, y) ? 'x' : '.').join('')) });
  const registeredEyes = pixelEyeMaskRegions(frame,species);
  const eyeBand = registeredEyes.length === 2 ? { left:Math.min(...registeredEyes.map(e=>e.left))-1, right:Math.max(...registeredEyes.map(e=>e.right))+1, top:Math.min(...registeredEyes.map(e=>e.top))-1, bottom:Math.max(...registeredEyes.map(e=>e.bottom))+1 } : undefined;
  const inEyeBand = (x:number,y:number) => !!eyeBand && (registeredEyes.some(e=>x>=e.left-1&&x<=e.right+1&&y>=e.top-1&&y<=e.bottom+1) || x>registeredEyes[0]!.right&&x<registeredEyes[1]!.left&&y>=eyeBand.top&&y<=eyeBand.bottom);
  const eyes: [number, number][] = [];
  frame.rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === 'i' || c === 'k') eyes.push([x, y]); }));
  const eyeY = eyes.length ? eyes.reduce((n, [, y]) => n + y, 0) / eyes.length : bounds.top + bounds.height * .45;
  const center = direction === 'front' ? (bounds.left + bounds.right) / 2 - (frame.pose === 'walkFront' ? -2 : 3) : bounds.left + bounds.width * .72;
  const iris: [number,number][] = [], ears: [number,number][] = [];
  frame.rows.forEach((row,y) => [...row].forEach((c,x) => { if (c === 'i' || c === 'h') iris.push([x,y]); if (c === 'e') ears.push([x,y]); }));
  const faceX = iris.length ? iris.reduce((n,[x]) => n+x,0)/iris.length : center;
  const faceY = iris.length ? iris.reduce((n,[,y]) => n+y,0)/iris.length : eyeY;
  const noseY = frame.rows.findIndex(row => row.includes('n'));
  const centralBridge = (x:number,y:number) => direction === 'front' && noseY >= 0 && y < noseY && y >= faceY-6 && Math.abs(x-faceX) <= 2;
  const earTop = Math.min(...ears.map(([,y]) => y)), crown = ears.filter(([,y]) => y < earTop + 7);
  const pointed = (x:number,y:number) => {
    const ear = direction === 'back' ? y < bounds.top+9 && (x < bounds.left+12 || x > bounds.right-12) : crown.some(([ex,ey]) => Math.abs(ex-x)<=3 && Math.abs(ey-y)<=4);
    const face = direction !== 'back' && ((x-faceX)/(direction==='side'?7:10))**2 + ((y-faceY-2)/9)**2 <= 1;
    const tail = frame.pose === 'sleep' ? x < bounds.left+bounds.width*.65 && y>36 : direction === 'side' || frame.pose === 'walkFront' ? x < bounds.left+bounds.width*.3 : x>bounds.left+bounds.width*.77 && y>25;
    const bridge = direction !== 'back' && crown.some(([ex,ey]) => {
      const at = (y-ey)/(faceY-ey || 1), line = ex+(faceX-ex)*at;
      return at >= 0 && at <= 1 && Math.abs(x-line) <= 1.5;
    });
    return ear || face || bridge || tail || y>=39;
  };
  let neck = species==='cat' && (frame.pose==='sit'||frame.pose==='blink') ? 31 : direction === 'front' ? Math.round(eyeY + 9) : Math.round(eyeY + 6);
  let bell: { x: number; y: number; distance: number } | undefined;
  // A full 2x2 patch must fit in fur/white; shifting the anchor preserves facial and outline slots.
  if (direction !== 'back') for (let y = Math.max(1, neck - 5); y <= Math.min(45, neck + 6); y++) for (let x = Math.max(1, Math.round(center) - 6); x <= Math.min(45, Math.round(center) + 6); x++) {
    const fits = [0,1].every(dy => [0,1].every(dx => ['b','s','t','w','W'].includes(frame.rows[y+dy]?.[x+dx] ?? '.')));
    const distance = Math.abs(x - Math.round(center)) + 2 * Math.abs(y - neck - 2);
    if (fits && (!bell || distance < bell.distance)) bell = { x,y,distance };
  }
  if (bell) neck = Math.min(neck, bell.y - 2);
  return {
    blaze: mask((x, y) => frontPoses.has(frame.pose) && Math.abs(x - center) <= 1 && y >= eyeY - 6 && y <= eyeY + 5),
    maskedEyes: mask((x, y) => frontPoses.has(frame.pose) && inEyeBand(x,y)),
    whiteMuzzle: mask((x, y) => frontPoses.has(frame.pose) && Math.abs(x - center) <= 11 && y >= eyeY + 1 && y <= eyeY + 7),
    pointed: { ...mask(pointed), rows: cleanPatternMask(frame.rows.map((row,y) => [...row].map((c,x) => (coatSlots.has(c) && pointed(x,y) || ['w','W'].includes(c) && centralBridge(x,y)) ? 'x' : '.').join('')),false,pixelEyeRegions(frame,species)) },
    collar: mask((x, y) => direction !== 'back' && y >= neck && y < neck + 2 && Math.abs(x - center) <= (direction === 'front' ? 10 : 7), true),
    bell: mask((x, y) => !!bell && x >= bell.x && x < bell.x + 2 && y >= bell.y && y < bell.y + 2, true),
  };
}


export function composePixelFrame(frame: PixelFrame, appearance: Appearance, species: CharacterSpecies = 'cat'): PixelPaintGrid {
  const shaped = replacePixelSilhouette(frame, appearance, species), masks = appearancePixelMasks(shaped,species), eyes = pixelEyeRegions(frame,species);
  const eyeSplit = shaped.pose === 'walkFront' ? 27 : shaped.pose === 'jump' ? 33 : shaped.pose === 'blink' && shaped.index === 3 ? 19 : shaped.pose === 'wave' && shaped.index !== 0 ? 20 : 24;
  const dogPatch = dogBicolorPixelMask(shaped);
  const white = coatPixelMask(shaped, 'bicolor','rows',species), ginger = coatPixelMask(shaped, 'calico','rows',species), black = coatPixelMask(shaped, 'calico', 'black',species);
  const grid = shaped.rows.map((row, y) => [...row].map((slot, x): PixelPaint | '.' => {
    const eye=eyes.find(region=>isPixelEye([region],x,y)), original=frame.rows[y]![x]!;
    if (eye && appearance.faceMark==='maskedEyes' && coatSlots.has(original) && masks.maskedEyes.rows[y]![x]==='x') return 'w';
    if (eye || original==='i' || original==='h') return (original==='i' ? eye?.side==='left'?'eyeLeft':eye?.side==='right'?'eyeRight':x<eyeSplit?'eyeLeft':'eyeRight' : original) as PixelPaint | '.';
    if (slot === '.') return '.';
    if (slot === 'i') return x < eyeSplit ? 'eyeLeft' : 'eyeRight';
    if (!coatSlots.has(slot)) {
      if (appearance.coatPattern === 'pointed' && ['w','W'].includes(slot) && masks.pointed.rows[y]![x] === 'x') return 't';
      if (appearance.collar !== 'none' && ['w', 'W'].includes(slot)) {
        if (masks.collar.rows[y]![x] === 'x') return 'collar';
        if (masks.bell.rows[y]![x] === 'x') return 'bell';
      }
      return slot as PixelPaint;
    }
    let paint: PixelPaint = slot as PixelPaint;
    if (appearance.coatPattern === 'solid' || appearance.coatPattern === 'bicolor') paint = slot === 't' ? 'b' : paint;
    if (appearance.coatPattern === 'tabbyWhite' && slot === 't') paint = 's';
    if (['bicolor', 'tabbyWhite'].includes(appearance.coatPattern) && white.rows[y]![x] === 'x') paint = slot === 's' ? 'W' : 'w';
    if (appearance.coatPattern === 'calico') paint = black.rows[y]![x] === 'x' ? 'black' : ginger.rows[y]![x] === 'x' ? 'ginger' : slot === 's' ? 'W' : 'w';
    if (appearance.coatPattern === 'pointed') paint = masks.pointed.rows[y]![x] === 'x' ? 't' : slot === 's' ? 'creamShade' : 'cream';
    if (species === 'dog' && appearance.coatPattern === 'bicolor') paint = dogPatch.rows[y]![x] === 'x' ? 't' : slot === 's' ? 'W' : 'w';
    if (appearance.faceMark !== 'none' && masks[appearance.faceMark].rows[y]![x] === 'x') paint = 'w';
    if (appearance.collar !== 'none') {
      if (masks.collar.rows[y]![x] === 'x') paint = 'collar';
      if (masks.bell.rows[y]![x] === 'x') paint = 'bell';
    }
    return paint;
  }));
  return cleanPatternPaint(grid, appearance.coatPattern === 'calico', eyes);
}

/** Pattern cleanup preserves connected markings and removes area-sampling singletons. */
const neighbors = [[1,0],[-1,0],[0,1],[0,-1]] as const;
const white = (c: string | undefined) => c === 'w' || c === 'W';
const patch = (c: string | undefined) => c === 'ginger' || c === 'black';
export function joinedPixel(rows: readonly (readonly string[] | string)[], x: number, y: number, value: string) {
  return neighbors.some(([dx,dy]) => rows[y+dy]?.[x+dx] === value);
}
export function blockPixel(rows: readonly (readonly string[] | string)[], x: number, y: number, value: string) {
  return [-1,0].some(dy => [-1,0].some(dx => [0,1].every(yy => [0,1].every(xx => rows[y+dy+yy]?.[x+dx+xx] === value))));
}
export function cleanPatternMask(rows: readonly string[], blocks = false, eyes: readonly PixelEyeRegion[] = []): string[] {
  return rows.map((row,y) => [...row].map((c,x) => c === 'x' && !isPixelEye(eyes,x,y) && !(blocks ? blockPixel(rows,x,y,c) : joinedPixel(rows,x,y,c)) ? '.' : c).join(''));
}
function whiteHole(rows: readonly (readonly string[])[], x: number, y: number) {
  return white(rows[y]?.[x]) && !neighbors.some(([dx,dy]) => white(rows[y+dy]?.[x+dx]));
}
function absorbWhiteHole<T extends string>(rows: T[][], x: number, y: number, coatWhite: ReadonlySet<string>, protectedCell: (x:number,y:number)=>boolean) {
  let best: { cells: [number,number][]; color: T; cost: number } | undefined;
  // A mixed-color boundary may need one neighboring patch cell merged too. Only repaint
  // a small coat rectangle whose result preserves every nearby patch's real 2x2 support.
  for (const [width,height] of [[1,1],[2,2],[2,3],[3,2],[3,3],[2,4],[4,2],[4,4]]) {
    for (let top=y-height!+1;top<=y;top++) for (let left=x-width!+1;left<=x;left++) {
      const cells: [number,number][] = [];
      for (let yy=top;yy<top+height!;yy++) for (let xx=left;xx<left+width!;xx++) cells.push([xx,yy]);
      if (!cells.every(([xx,yy])=>!protectedCell(xx,yy) && (patch(rows[yy]?.[xx]) || whiteHole(rows,xx,yy) || white(rows[yy]?.[xx]) && coatWhite.has(`${xx},${yy}`)))) continue;
      for (const color of ['ginger','black'] as T[]) {
        const cost = cells.filter(([xx,yy])=>rows[yy]![xx]!==color).length;
        if (best && cost>=best.cost) continue;
        const old=cells.map(([xx,yy])=>rows[yy]![xx]!);
        cells.forEach(([xx,yy])=>{rows[yy]![xx]=color;});
        let valid=true;
        for (let yy=top-1;yy<=top+height!;yy++) for (let xx=left-1;xx<=left+width!;xx++) if (patch(rows[yy]?.[xx]) && !blockPixel(rows,xx,yy,rows[yy]![xx]!)) valid=false;
        cells.forEach(([xx,yy],i)=>{rows[yy]![xx]=old[i]!;});
        if (valid) best={cells,color,cost};
      }
    }
  }
  best?.cells.forEach(([xx,yy])=>{rows[yy]![xx]=best!.color;});
}
export function cleanPatternPaint<T extends string>(input: readonly (readonly T[])[], calico: boolean, eyes: readonly PixelEyeRegion[] = []): T[][] {
  const rows = input.map(row => [...row]);
  const besideEye=(x:number,y:number)=>eyes.some(e=>x>=e.left-1&&x<=e.right+1&&y>=e.top-1&&y<=e.bottom+1);
  const besideOpenEye=(x:number,y:number)=>eyes.some(e=>e.kind!=='closed'&&x>=e.left-1&&x<=e.right+1&&y>=e.top-1&&y<=e.bottom+1);
  const protectedCell=(x:number,y:number)=>isPixelEye(eyes,x,y)||isPixelEyeSlot(input[y]?.[x] ?? '.');
  if (calico) {
    const coatWhite = new Set<string>();
    input.forEach((row,y)=>row.forEach((_,x)=>{if(!protectedCell(x,y)&&whiteHole(input,x,y)) coatWhite.add(`${x},${y}`);}));
    input.forEach((row,y)=>row.forEach((c,x)=>{
      if (protectedCell(x,y) || !patch(c) || blockPixel(input,x,y,c)) return;
      rows[y]![x]='w' as T;
      coatWhite.add(`${x},${y}`);
    }));
    for (let y=0;y<rows.length;y++) for (let x=0;x<rows[y]!.length;x++) if (!protectedCell(x,y) && white(rows[y]![x]) && (whiteHole(rows,x,y) || coatWhite.has(`${x},${y}`))) {
      absorbWhiteHole(rows,x,y,coatWhite,protectedCell);
      if (white(rows[y]![x]) && (whiteHole(rows,x,y) || coatWhite.has(`${x},${y}`))) {
        const adjacent=neighbors.map(([dx,dy])=>rows[y+dy]?.[x+dx]);
        const nearEye=besideEye(x,y);
        // Eye interiors are already protected. A white boundary defect must never extend its dark outline.
        const edge=adjacent.find(c=>c==='e'||c==='b'||c==='s'||!nearEye&&(c==='o'||c==='m'||c==='k'));
        if(edge)rows[y]![x]=edge as T;
        else if(nearEye)rows[y]![x]='b' as T;
      }
    }
  }
  const snapshot=rows.map(row=>[...row]);
  snapshot.forEach((row,y)=>row.forEach((c,x)=>{
    if (protectedCell(x,y) || (c!=='t' && c!=='w') || joinedPixel(snapshot,x,y,c)) return;
    const adjacent: readonly string[]=neighbors.map(([dx,dy])=>snapshot[y+dy]?.[x+dx]);
    if (c==='w') {
      // A different white shade is valid only inside an already connected white marking.
      if (adjacent.some(white)) rows[y]![x]='W' as T;
      else if (!calico) rows[y]![x]=(neighbors.map(([dx,dy])=>protectedCell(x+dx,y+dy)?'.':snapshot[y+dy]?.[x+dx]).find(v=>['b','s','cream','creamShade','t',...(besideEye(x,y)?[]:['k','m','o'])].includes(v ?? '.')) ?? 'W') as T;
    } else rows[y]![x]=(adjacent.includes('cream')?'cream':adjacent.some(white)?adjacent.includes('w')?'w':'W':adjacent.includes('o')&&!besideOpenEye(x,y)?'o':'b') as T;
  }));
  return rows;
}
