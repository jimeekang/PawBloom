import { isPixelEye, pixelEyeRegions } from './pixelEyes';
import type { Appearance, CharacterSpecies } from './appearance';
import { getPixelFrame, pixelBounds, pixelDirection, type PixelFrame } from './pixelFrames';

/** Replacement patches remove the old silhouette first; fur/build remain v1 storage-only fields. */
export function replacePixelSilhouette(frame: PixelFrame, appearance: Appearance, species: CharacterSpecies): PixelFrame {
  if (species === 'other') return frame;
  const rows = frame.rows.map(row => [...row]), direction = pixelDirection(frame.pose), bounds = pixelBounds(frame.rows);
  if (species === 'dog' && appearance.earShape === 'pointed') {
    const cat = getPixelFrame('cat', frame.pose === 'walkSide' ? 'walkRight' : frame.pose, frame.index);
    const noseRows = cat.rows.flatMap((row, y) => row.includes('n') ? [y] : []);
    const sourceEyes = pixelEyeRegions(cat, 'cat'), targetEyes = pixelEyeRegions(frame, species);
    const headBottom = noseRows.length ? Math.min(...noseRows) : 26;
    // Copy only the pointed skull. Source cat eyes are face coat here, never dog eye data.
    for (let y = 0; y < headBottom; y++) for(let x=0;x<48;x++) {
      if(isPixelEye(targetEyes,x,y) || ['n','m','w','W'].includes(frame.rows[y]![x]!)) continue;
      const source=cat.rows[y]![x]!;
      rows[y]![x]=isPixelEye(sourceEyes,x,y) && source!=='.' ? 'b' : source;
    }
  }
  if (direction !== 'back' && ['folded', 'curled'].includes(appearance.earShape)) replaceEars(rows, frame, appearance.earShape);

  if (appearance.tail !== 'long' && (frame.pose === 'sit' || direction === 'side')) {
    const sleeping = frame.pose === 'sleep';
    const region = (x: number, y: number) => sleeping ? x < bounds.left + bounds.width * .6 && y > 37 : direction === 'front' ? x > bounds.left + bounds.width * .76 && y > 25 && y < 40 : x < bounds.left + bounds.width * .31 && y < bounds.top + bounds.height * .62;
    if (appearance.tail === 'short' && frame.pose === 'stretch') {
      const roots = [[10,28],[9,26],[7,25],[9,27]] as const;
      const [rootX, rootY] = roots[frame.index]!;
      // Explicit stretch patches remove the entire old tip, including its rightmost loose outline.
      for (let y = 12; y <= (frame.index === 0 || frame.index === 3 ? 24 : 23); y++) for (let x = 2; x <= 18; x++) rows[y]![x] = '.';
      for (let step = 0; step <= 12; step++) {
        const cx = Math.round(5 + (rootX - 5) * step / 12), cy = Math.round(19 + (rootY - 19) * step / 12);
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 4) rows[cy + dy]![cx + dx] = 'b';
      }
    } else if (appearance.tail === 'short') {
      for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if (region(x, y) && (sleeping ? y < 41 : direction === 'front' ? x > bounds.left + bounds.width * .87 : y < bounds.top + bounds.height * .36)) rows[y]![x] = '.';
    } else {
      // One-pixel stair-step tufts extend the tail only; do not change paws or face.
      for (let y = 2; y < 43; y++) for (let x = 2; x < 46; x++) if (region(x, y) && frame.rows[y]![x] === 'o' && y % 3 === 0) {
        const dx = direction === 'front' ? 1 : -1;
        if (rows[y]![x + dx] === '.') rows[y]![x + dx] = 'b';
      }
    }
  }
  const eyes=pixelEyeRegions(frame,species);
  // Keep the original opaque face attachment directly beside a protected eye box.
  frame.rows.forEach((row,y)=>[...row].forEach((c,x)=>{
    if(isPixelEye(eyes,x,y) || c!=='.' && [[0,1],[0,-1],[1,0],[-1,0],[0,2],[0,-2],[2,0],[-2,0],[1,1],[1,-1],[-1,1],[-1,-1]].some(([dx,dy])=>isPixelEye(eyes,x+dx!,y+dy!)))rows[y]![x]=c;
  }));
  const old = rows.map(row => [...row]);
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if (old[y]![x] !== '.' && [[0,1],[0,-1],[1,0],[-1,0]].some(([dx,dy]) => !old[y + dy]?.[x + dx] || old[y + dy]![x + dx] === '.')) rows[y]![x] = 'o';
  frame.rows.forEach((row,y)=>[...row].forEach((c,x)=>{if(isPixelEye(eyes,x,y))rows[y]![x]=c;}));
  return { ...frame, rows: rows.map(row => row.join('')) };
}


function polygon(rows: string[][], points: readonly (readonly number[])[], slot: string) {
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
    let inside = false;
    for (let i=0,j=points.length-1;i<points.length;j=i++) {
      const [xi,yi] = points[i]!, [xj,yj] = points[j]!;
      if ((yi!>y+.5)!==(yj!>y+.5) && x+.5 < (xj!-xi!)*(y+.5-yi!)/(yj!-yi!)+xi!) inside = !inside;
    }
    if (inside) rows[y]![x] = slot;
  }
}
function replaceEars(rows: string[][], frame: PixelFrame, shape: Appearance['earShape']) {
  const all: [number,number][] = [];
  frame.rows.forEach((row,y) => [...row].forEach((c,x) => { if (c === 'e') all.push([x,y]); }));
  if (!all.length) return;
  const earTop = Math.min(...all.map(([,y]) => y)), crown = all.filter(([,y]) => y < earTop + 6);
  const xs = [...new Set(crown.map(([x]) => x))].sort((a,b) => a-b), groups: number[][] = [];
  for (const x of xs) { if (!groups.length || x - groups[groups.length-1]![groups[groups.length-1]!.length-1]! > 5) groups.push([]); groups[groups.length-1]!.push(x); }
  const front = groups.length > 1, left = Math.max(1, xs[0]! - (front ? 3 : 6)), right = Math.min(46, xs[xs.length-1]! + (front ? 3 : 11));
  const roof = earTop + (front ? 3 : 2), base = earTop + 8;
  const eyeRows = frame.rows.flatMap((row,y) => /[ih]/.test(row) ? [y] : []), eyeTop = eyeRows.length ? Math.min(...eyeRows) : 48;
  for (let y = Math.max(0, earTop-6); y <= base; y++) for (let x=left; x<=right; x++) rows[y]![x] = '.';
  // Rounded skull joins both ear roots; no flat hat or separately floating pink ornament.
  const insets = [15,11,8,5,3,1,0];
  for (let y=roof;y<=base;y++) {
    const inset = insets[Math.min(insets.length-1,y-roof)]!;
    for (let x=left+inset;x<=right-inset;x++) rows[y]![x] = ['b','s','t'].includes(frame.rows[y]![x]!) ? frame.rows[y]![x]! : 'b';
  }
  groups.forEach((group,index) => {
    const cx = Math.round(group.reduce((sum,x) => sum+x,0)/group.length), outward = front && index === groups.length-1 ? 1 : -1;
    const local = (u:number,v:number) => [cx+u*outward,roof+v] as const;
    if (shape === 'folded') {
      polygon(rows,[local(-5,6),local(5,6),local(4,-1),local(1,-2)],'b');
      polygon(rows,[local(-1,5),local(3,5),local(2,1)],'e');
    } else {
      polygon(rows,[local(-5,6),local(5,6),local(2,-1),local(-1,0)],'b');
      const curl = ['..bbbbb...','.bbbbbbb..','.bbbb.....','..bbbb....','.bbbbbb...','bbbeebbb..','bbbeebbbb.','bbbbbbbbb.'];
      curl.forEach((row,py) => [...row].forEach((c,px) => {
        const x = cx - (px-6)*outward, y = roof-3+py;
        if (c !== '.' && rows[y]?.[x] !== undefined) rows[y]![x] = c;
      }));
    }
  });
  const originalBounds = pixelBounds(frame.rows);
  for (let y=0;y<48;y++) for (let x=0;x<48;x++) if (x < originalBounds.left || x > originalBounds.right) rows[y]![x] = '.';
  // Keep source eye/nose/glint slots when an action's ears overlap the upper face registration.
  for (let y=Math.max(0,eyeTop-1);y<=base;y++) for (let x=left;x<=right;x++) if (['i','k','h','w','W','n','m'].includes(frame.rows[y]![x]!)) rows[y]![x] = frame.rows[y]![x]!;
}
