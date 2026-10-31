import { isPixelEye, isPixelEyeSlot, type PixelEyeRegion } from './pixelEyes';

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
