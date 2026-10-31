import { getPixelClip, getPixelFrame, pixelBounds, pixelPoses, pixelSlots, type PixelFrame } from './pixelFrames';
import { tracedPixelFrames, tracedCoatMasks } from './pixelFrames.generated';
import { correctedPixelFrameIds, pixelFrameCorrectionReasons } from './pixelFrames.overrides';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function throws(fn: () => void, reason: string) { let error = ''; try { fn(); } catch (e) { error = String(e); } assert(error.includes(reason), `negative fixture must detect ${reason}: ${error}`); }
function checkFrame(frame: PixelFrame) {
  const id = `${frame.pose}:${frame.index}`;
  assert(frame.width === 48 && frame.height === 48 && frame.rows.length === 48 && frame.rows.every(row => row.length === 48), `${id}: dimensions`);
  assert(frame.rows.every(row => [...row].every(c => pixelSlots.includes(c as typeof pixelSlots[number]))), `${id}: slots`);
  const b = pixelBounds(frame.rows);
  assert(b.width >= 30 && b.width <= 46 && b.height >= 20, `${id}: visible silhouette`);
  assert(Math.abs(b.bottom - 44) <= 1, `${id}: baseline`);
  frame.rows.forEach((row, y) => [...row].forEach((slot, x) => {
    if (!['b','s','t'].includes(slot)) return;
    for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) assert(frame.rows[y + dy]?.[x + dx] && frame.rows[y + dy]![x + dx] !== '.', `${id}: outline at ${x},${y}`);
  }));
  if (frame.pose === 'walkBack') assert(!/[ikhmn]/.test(frame.rows.join('')), `${id}: back face`);
  else {
    const eyeRows = frame.rows.slice(b.top + Math.floor(b.height * .2), b.top + Math.ceil(b.height * .82));
    const eyeRegion = eyeRows.map(row => frame.pose === 'sleep' || ['walkRight','walkSide','stretch','run'].includes(frame.pose) ? row.slice(b.left + Math.floor(b.width * .52), b.right) : row.slice(b.left + 3, b.left + Math.ceil(b.width * .84))).join('');
    assert(/[ik]/.test(eyeRegion), `${id}: eyes in face region`);
  }
}
function checkClip(frames: readonly PixelFrame[]) {
  frames.forEach(checkFrame);
  const boxes = frames.map(f => pixelBounds(f.rows));
  assert(Math.max(...boxes.map(b => b.width)) - Math.min(...boxes.map(b => b.width)) <= 3, 'clip bbox width');
  assert(Math.max(...boxes.map(b => b.height)) - Math.min(...boxes.map(b => b.height)) <= 3, 'clip bbox height');
  if (frames.length > 1) assert(new Set(frames.map(f => f.rows.join(''))).size === frames.length, 'each phase has distinct pixel data');
}
const expected = { sit: 1, blink: 4, wave: 4, sleep: 4, stretch: 4, walkRight: 4, walkFront: 4, walkBack: 4, run: 1, jump: 1 };
assert(pixelPoses.join() === Object.keys(expected).join(), 'full clip contract');
assert(tracedPixelFrames.length === 31, '31 source cat frames');
for (const pose of pixelPoses) {
  const clip = getPixelClip('cat', pose);
  assert(clip.length === expected[pose] && clip.every((f, index) => f.index === index && f.pose === pose), `registered ${pose} indices`);
  checkClip(clip);
}
for (const [pose, length] of [['sit',1],['blink',4],['walkSide',4],['sleep',4]] as const) {
  const frames = getPixelClip('dog', pose); assert(frames.length === length, `dog ${pose} count`); checkClip(frames);
}
for (const pose of pixelPoses) {
  assert(getPixelFrame('other', pose).pose === 'sit', 'other always has safe rounded frame');
  if (!['sit','blink','walkRight','sleep'].includes(pose)) assert(getPixelFrame('dog', pose).pose === 'sit', 'unsupported dog pose falls back to sit');
}
checkFrame(getPixelFrame('other'));
assert(getPixelFrame('cat','idle').pose === 'sit' && getPixelFrame('cat','lift').pose === 'run' && getPixelFrame('cat','saveReact').pose === 'stretch', 'v2 pose aliases survive');
assert(getPixelFrame('dog','walkRight').pose === 'walkSide', 'WO-B movement maps to dog side cycle');
assert(Object.keys(tracedCoatMasks).length === 8 && Object.values(tracedCoatMasks).every(mask => mask.rows.length === 48 && mask.rows.every(row => row.length === 48 && /^[x.]+$/.test(row)) && mask.rows.some(row => row.includes('x'))), 'four real reference directions for each coat mask');
assert(correctedPixelFrameIds.every(id => pixelFrameCorrectionReasons[id] && tracedPixelFrames.some(f => `${f.pose}:${f.index}` === id)), 'each override identifies source and reason');

const good = getPixelFrame('cat');
const change = (frame: PixelFrame, x: number, y: number, c: string): PixelFrame => ({ ...frame, rows: frame.rows.map((row, iy) => iy === y ? row.slice(0, x) + c + row.slice(x + 1) : row) });
throws(() => checkFrame({ ...good, rows: good.rows.slice(1) }), 'dimensions');
throws(() => checkFrame(change(good, 0, 0, '?')), 'slots');
const border = good.rows.flatMap((row,y) => [...row].flatMap((c,x) => c === 'o' && [[0,1],[0,-1],[1,0],[-1,0]].some(([dx,dy]) => ['b','s','t'].includes(good.rows[y+dy]?.[x+dx] ?? '.')) ? [[x,y]] : []))[0]!;
throws(() => checkFrame(change(good, border[0]!, border[1]!, '.')), 'outline');
throws(() => checkFrame({ ...good, rows: ['.'.repeat(48), '.'.repeat(48), ...good.rows.slice(0,46)] }), 'baseline');
const blink = getPixelClip('cat','blink');
const narrowRows = blink[0]!.rows.map(row => '.'.repeat(6) + Array.from({ length: 36 }, (_, x) => row[Math.floor(x * 48 / 36)]).join('') + '.'.repeat(6));
const narrow = { ...blink[0]!, rows: narrowRows.map((row,y) => [...row].map((c,x) => c !== '.' && [[0,1],[0,-1],[1,0],[-1,0]].some(([dx,dy]) => !narrowRows[y+dy]?.[x+dx] || narrowRows[y+dy]![x+dx] === '.') ? 'o' : c).join('')) };
// Keep this fixture individually valid so the actual clip validator must reject its size jump.
checkFrame(narrow);
throws(() => checkClip([narrow,blink[3]!]), 'clip bbox width');
throws(() => checkFrame({ ...good, rows: good.rows.map(row => row.replace(/[ikh]/g,'b')) }), 'eyes in face region');
throws(() => checkFrame(change(getPixelFrame('cat','walkBack'), 24,20,'n')), 'back face');
console.log(`Pixel quality: 31 cat + 13 dog + other; ${correctedPixelFrameIds.length} documented overrides; 7 negative fixtures.`);

