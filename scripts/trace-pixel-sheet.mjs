import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
const root = process.cwd(), require = createRequire(import.meta.url);
const { PNG } = require(join(root, 'apps/mobile/node_modules/pngjs'));
const reference = join(root, 'docs/design/character-v3/reference'), output = join(root, 'docs/design/character-v3');
mkdirSync(output, { recursive: true });
const load = name => PNG.sync.read(readFileSync(join(reference, `pawbloom-pixel-cat-${name}.png`)));
const images = { actions: load('actions-transparent-v2'), walk: load('walk-transparent-v2'), angles: load('angles-motion-v1'), coats: load('coat-variants-v1') };
// Measured sprite ROIs: the generated references cross the nominal quarter-cell boundaries.
const cells = (ys, xs) => xs.map(([left, right]) => [left - 2, ys[0] - 2, right + 2, ys[1] + 2]);
const groups = [
 ['actions','blink', cells([87,336], [[74,307],[369,609],[672,910],[978,1234]])],
 ['actions','wave', cells([376,632], [[68,312],[371,618],[675,916],[971,1219]])],
 ['actions','sleep', cells([721,903], [[35,320],[346,628],[649,927],[947,1240]])],
 ['actions','stretch', cells([949,1179], [[34,307],[333,613],[644,951],[976,1226]])],
 ['walk','walkRight', cells([90,308], [[21,308],[338,621],[659,928],[960,1240]])],
 ['walk','walkFront', cells([643,897], [[21,261],[324,576],[635,884],[957,1202]])],
 ['walk','walkBack', cells([926,1186], [[58,311],[369,620],[683,934],[997,1247]])],
 ['angles','run', [[21,982,324,1171]]], ['angles','jump', [[361,955,606,1167]]],
];
// Reference RGB samples from the sheets, not application colors. Rendering uses tokens only.
const swatches = { b:[220,155,92], s:[192,131,70], t:[148,96,52], w:[252,243,226], W:[230,207,177], e:[250,151,137], i:[133,210,208], k:[49,22,30], h:[190,238,222], n:[244,128,133] };
const distance = (a,b) => a.slice(0,3).reduce((sum,v,i) => sum+(v-b[i])**2,0);
const pixel = (image,x,y) => [...image.data.subarray((y*image.width+x)*4,(y*image.width+x)*4+4)];
function crop(image, roi, keyed = false) {
 const [left,top,right,bottom] = roi, width=right-left+1,height=bottom-top+1;
 const visible = new Uint8Array(width*height), rgb=[];
 for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
  const c=pixel(image,left+x,top+y); rgb.push(c); visible[y*width+x]=c[3]>=220?1:0;
 }
 if(keyed) {
  // Remove only border-connected cream, preserving enclosed white muzzle/socks. Shadow is lavender.
  const cream = c => c[0]>225 && c[1]>219 && c[2]>201;
  const queue=[]; const add=(x,y)=>{const p=y*width+x;if(visible[p]&&cream(rgb[p])){visible[p]=0;queue.push(p);}};
  for(let x=0;x<width;x++){add(x,0);add(x,height-1);}for(let y=0;y<height;y++){add(0,y);add(width-1,y);}
  for(let at=0;at<queue.length;at++){const p=queue[at],x=p%width,y=Math.floor(p/width);if(x)add(x-1,y);if(x+1<width)add(x+1,y);if(y)add(x,y-1);if(y+1<height)add(x,y+1);}
  for(let p=0;p<rgb.length;p++){const [r,g,b]=rgb[p];if(b>r*0.98&&b>g*1.025&&r>130&&g>110)visible[p]=0;}
 }
 let minX=width,minY=height,maxX=-1,maxY=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(visible[y*width+x]){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 if(maxX<minX)throw new Error(`Empty source ROI ${roi}`);
 return {width,height,rgb,visible,minX,minY,maxX,maxY,w:maxX-minX+1,h:maxY-minY+1};
}
function classify(c,x,y,pose) {
 let slot=Object.keys(swatches).sort((a,b)=>distance(c,swatches[a])-distance(c,swatches[b]))[0];
 const front=['sit','blink','wave','walkFront'].includes(pose);
 if(slot==='k') {
  const eye=front ? y>.24&&y<.57&&x>.13&&x<.8 : y>.24&&y<.7&&x>.53;
  slot=pose==='walkBack'?'o':eye?'k':front&&y>.48&&y<.67?'m':'o';
 }
 if(slot==='n')slot=y>.7?'p':front&&y>.35&&y<.65||!front&&x>.55&&y>.3&&y<.8?'n':'e';
 if(pose==='walkBack'&&['i','h','n','m','k'].includes(slot))slot='b';
 return slot;
}
function sample(source,scale,pose) {
 const w=Math.max(1,Math.round(source.w*scale)),h=Math.max(1,Math.round(source.h*scale)),left=Math.floor((48-w)/2),top=45-h;
 const rows=Array.from({length:48},()=>Array(48).fill('.'));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const counts={};let total=0,opaque=0;
  const x0=source.minX+x/scale,x1=source.minX+(x+1)/scale,y0=source.minY+y/scale,y1=source.minY+(y+1)/scale;
  for(let sy=Math.floor(y0);sy<Math.min(source.height,Math.ceil(y1));sy++)for(let sx=Math.floor(x0);sx<Math.min(source.width,Math.ceil(x1));sx++){
   const weight=Math.max(0,Math.min(sx+1,x1)-Math.max(sx,x0))*Math.max(0,Math.min(sy+1,y1)-Math.max(sy,y0));total+=weight;
   if(!source.visible[sy*source.width+sx])continue;opaque+=weight;
   const slot=classify(source.rgb[sy*source.width+sx],x/w,y/h,pose);counts[slot]=(counts[slot]??0)+weight;
  }
  if(opaque>=total*.35&&opaque>0)rows[top+y][left+x]=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
 }
 return {pose,index:0,width:48,height:48,rows:rows.map(r=>r.join(''))};
}
const frames=[], previews={actions:[],walk:[],angles:[],coats:[]};
for(const [sheet,pose,rois] of groups){
 const sources=rois.map(roi=>crop(images[sheet],roi,sheet==='angles'));
 const scale=44/Math.max(...sources.map(s=>Math.max(s.w,s.h)));
 sources.forEach((source,index)=>{const f={...sample(source,scale,pose),index};frames.push(f);previews[sheet].push(f);});
}
frames.unshift({...frames[0],pose:'sit',index:0});
const coatMasks={};
for(const [pattern,rois] of [
 ['bicolor',[[129,412,337,647],[371,416,661,649],[696,416,920,649],[944,403,1196,649]]],
 ['calico',[[128,674,337,912],[374,680,668,914],[696,684,920,918],[949,676,1232,900]]],
])for(let index=0;index<4;index++){
 const source=crop(images.coats,rois[index],true),direction=['front','side','back','action'][index];
 const f=sample(source,44/Math.max(source.w,source.h),direction==='back'?'walkBack':direction==='side'?'walkRight':'sit');
 previews.coats.push(f);
 const mask=(kind)=>f.rows.map(row=>[...row].map(c=>kind==='white'?['w','W'].includes(c)?'x':'.':'.').join(''));
 // Classify original coat pixels in the same resampling registration; never infer calico from tabby data.
 const custom=(kind)=>{
  const rows=Array.from({length:48},()=>Array(48).fill('.')),scale=44/Math.max(source.w,source.h),w=Math.round(source.w*scale),h=Math.round(source.h*scale),left=Math.floor((48-w)/2),top=45-h;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const sx=Math.min(source.maxX,Math.floor(source.minX+(x+.5)/scale)),sy=Math.min(source.maxY,Math.floor(source.minY+(y+.5)/scale)),p=sy*source.width+sx,[r,g,b]=source.rgb[p];
   if(source.visible[p]&&(kind==='ginger'?r>170&&r>g*1.3&&g>b*1.15:Math.max(r,g,b)<125))rows[top+y][left+x]='x';
  }return rows.map(row=>row.join(''));
 };
 const points=f.rows.flatMap((row,y)=>[...row].flatMap((c,x)=>c==='.'?[]:[[x,y]]));
 const left=Math.min(...points.map(([x])=>x)),top=Math.min(...points.map(([,y])=>y)),right=Math.max(...points.map(([x])=>x)),bottom=Math.max(...points.map(([,y])=>y));
 coatMasks[`${pattern}:${direction}`]={bounds:{left,top,width:right-left+1,height:bottom-top+1},rows:pattern==='bicolor'?mask('white'):custom('ginger'),...(pattern==='calico'?{black:custom('black')}:{})};
}
const previewColors={'.':[0,0,0,0],o:[53,28,47,255],...Object.fromEntries(Object.entries(swatches).map(([k,v])=>[k,[...v,255]])),m:[53,28,47,255],p:[247,151,146,255]};
for(const [sheet,items] of Object.entries(previews)){
 const cols=4,cell=196,png=new PNG({width:cols*cell,height:Math.ceil(items.length/cols)*cell});png.data.fill(0);
 items.forEach((frame,index)=>frame.rows.forEach((row,y)=>[...row].forEach((c,x)=>{
  for(let dy=0;dy<4;dy++)for(let dx=0;dx<4;dx++){const px=(index%cols)*cell+x*4+dx,py=Math.floor(index/cols)*cell+y*4+dy,at=(py*png.width+px)*4;const rgb=previewColors[c];for(let v=0;v<4;v++)png.data[at+v]=rgb[v];}
 })));
 writeFileSync(join(output,`trace-${sheet}.png`),PNG.sync.write(png));
}
const compressed = data=>JSON.stringify(data);
writeFileSync(join(root,'apps/mobile/src/contexts/avatar/domain/pixelFrames.generated.ts'),`// Generated by node scripts/trace-pixel-sheet.mjs. Do not edit; corrections belong in pixelFrames.overrides.ts.\nimport type { PixelFrame } from './pixelFrames';\nexport const tracedPixelFrames: readonly PixelFrame[] = [\n${frames.map(f=>compressed(f)).join(',\n')}\n];\nexport const tracedCoatMasks = ${compressed(coatMasks)} as const;\n`);
console.log(`Traced ${frames.length} cat frames and ${Object.keys(coatMasks).length} coat masks from four source sheets.`);
