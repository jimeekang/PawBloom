import { isPixelEye, pixelEyeRegions } from './pixelEyes';
import { coatPatterns, defaultAppearance, earShapes, normalizeAppearance, type Appearance } from './appearance';
import { getPixelFrame, getPixelClip, pixelPoses, pixelBounds } from './pixelFrames';
import { appearancePixelMasks, coatPixelMask, composePixelFrame, type PixelPaintGrid } from './pixelMasks';
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const frame = getPixelFrame('cat'), base = defaultAppearance();
const grid = (changes: Partial<Appearance>) => composePixelFrame(frame, { ...base, ...changes });
for (const pattern of coatPatterns) {
  const a = { ...base, coatPattern: pattern };
  const painted = composePixelFrame(frame, a);
  frame.rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (!['.', 'o', 'k', 'm', 'n', 'e', 'p', 'h', 'w', 'W'].includes(c)) return;
    const bridge = pattern === 'pointed' && ['w','W'].includes(c) && appearancePixelMasks(frame).pointed.rows[y]![x] === 'x';
    assert(painted[y]![x] === (bridge ? 't' : c), `${pattern} protects ${c} at ${x},${y}`);
  }));
}
assert(new Set(coatPatterns.map(coatPattern => JSON.stringify(grid({ coatPattern })))).size === 6, 'all six coat rules alter pixel paint');
for (const coatPattern of ['bicolor','tabbyWhite'] as const) {
  const a = grid({ coatPattern, accentColor: 'ginger' });
  assert(same(a, grid({ coatPattern, accentColor: 'lilac' })), 'two-color cats ignore arbitrary accent');
  assert(!a.flat().includes('t') && !a.flat().includes('ginger') && !a.flat().includes('black'), 'two-color coats introduce no third coat color');
}
const calico = grid({ coatPattern: 'calico' });
assert(!calico.some((row,y)=>row.some((c,x)=>!isPixelEye(pixelEyeRegions(frame),x,y)&&['b','s','t','cream','creamShade'].includes(c))), 'calico removes original coat paint');
assert(calico.flat().includes('ginger') && calico.flat().includes('black'), 'calico uses both source-derived patches');
assert(same(calico, grid({ coatPattern: 'calico', coatColor: 'chocolate', accentColor: 'lilac' })), 'calico patch identity is fixed');
for (const pose of ['sit','walkRight','walkBack','jump'] as const) {
  const f = getPixelFrame('cat', pose);
  for (const pattern of ['bicolor','calico'] as const) {
    if (pose === 'walkBack' && pattern === 'bicolor') continue; // The tuxedo reference has only socks here, already fixed white in the base.
    assert(coatPixelMask(f, pattern).rows.some(row => row.includes('x')), `${pattern} ${pose}: source mask is actually applied`);
  }
}
for (const faceMark of ['blaze','maskedEyes','whiteMuzzle'] as const) {
  assert(!same(grid({ faceMark }), grid({})), `${faceMark} visibly changes front coat`);
  for (const pose of ['walkRight','walkBack','sleep','jump'] as const) {
    const f = getPixelFrame('cat', pose);
    assert(same(composePixelFrame(f, base), composePixelFrame(f, { ...base, faceMark })), `${faceMark} excluded from non-front pose`);
  }
}
for (const earShape of ['folded','curled'] as const) assert(!same(grid({ earShape }), grid({})), `${earShape} replaces the ear silhouette`);
for (const tail of ['short','fluffy'] as const) {
  assert(!same(grid({ tail }), grid({})), `${tail} replaces sitting tail`);
  const side = getPixelFrame('cat','walkRight');
  assert(!same(composePixelFrame(side, base), composePixelFrame(side, { ...base, tail })), `${tail} changes side tail`);
}
const dressed = grid({ collar: 'red' }), masks = appearancePixelMasks(frame);
assert(dressed.flat().filter(p => p === 'bell').length === 4, 'bell occupies exactly 2x2 cells');
assert(dressed.flat().filter(p => p === 'collar').length >= 6, 'neck band has visible width');
frame.rows.forEach((row,y) => [...row].forEach((c,x) => { if (['i','k','h','n','m','e','p'].includes(c)) assert(dressed[y]![x] === (c === 'i' ? x < 24 ? 'eyeLeft' : 'eyeRight' : c), 'accessories preserve facial features'); }));
assert(masks.bell.rows.filter(row => row.includes('x')).length === 2, 'bell has two rows');
assert(same(grid({ furLength: 'long', build: 'round' }), grid({})), 'v1-only fur/build stay valid without fake render differences');
const odd = grid({ eyeColor: 'odd' });
assert(odd.some(row => row.slice(0,24).includes('eyeLeft')) && odd.some(row => row.slice(24).includes('eyeRight')), 'both iris sides retain independent semantic slots');
function closed(grid: PixelPaintGrid, id: string) {
  assert(grid.length === 48 && grid.every(row => row.length === 48), `${id}: composed dimensions`);
  grid.forEach((row,y) => row.forEach((c,x) => {
    if (c === '.' || c === 'o') return;
    for (const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]) assert(grid[y+dy]?.[x+dx] !== undefined && grid[y+dy]![x+dx] !== '.', `${id}: replaced silhouette has closed outline at ${x},${y}`);
  }));
}
for (const pose of pixelPoses) for (const f of getPixelClip('cat', pose)) for (const earShape of ['pointed','folded','curled'] as const) for (const tail of ['long','short','fluffy'] as const) closed(composePixelFrame(f, { ...base, earShape, tail }), `${pose}:${f.index}/${earShape}/${tail}`);

// Regression: all appearance patches retain clip registration, not just the raw frame data.
for (const species of ['cat','dog'] as const) for (const pose of pixelPoses) for (const earShape of species === 'cat' ? ['pointed','folded','curled'] as const : ['pointed','floppy'] as const) for (const tail of ['long','short','fluffy'] as const) {
  const grids = getPixelClip(species, pose).map(f => composePixelFrame(f, { ...defaultAppearance(species), earShape, tail }, species));
  const boxes = grids.map(g => pixelBounds(g.map(row => row.map(c => c === '.' ? '.' : 'x').join(''))));
  assert(boxes.every(b => Math.abs(b.bottom - 44) <= 1), `${species}/${pose}/${earShape}/${tail}: composed baseline`);
  for (const size of ['width','height'] as const) assert(Math.max(...boxes.map(b => b[size])) - Math.min(...boxes.map(b => b[size])) <= 3, `${species}/${pose}/${earShape}/${tail}: composed bbox ${size}`);
}
// Short stretch must not leave detached pixels from the former tall tail's right edge.
for (const frame of getPixelClip('cat','stretch')) for (const earShape of ['pointed','folded','curled'] as const) {
  const g = composePixelFrame(frame, { ...base, tail: 'short', earShape });
  const reached = new Set<number>(), queue: [number,number][] = [[24,36]];
  for (let at = 0; at < queue.length; at++) {
    const [x,y] = queue[at]!, id = y * 48 + x;
    if (reached.has(id) || g[y]?.[x] === undefined || g[y]![x] === '.') continue;
    reached.add(id);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) queue.push([x+dx,y+dy]);
  }
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if (g[y]![x] !== '.') assert(reached.has(y * 48 + x), `stretch:${frame.index}/${earShape}: detached replacement pixel ${x},${y}`);
}

// Review regressions: a dog keeps its bicolor ear/eye patch in every supported pose.
for (const pose of ['sit','blink','walkSide','sleep'] as const) for (const f of getPixelClip('dog', pose)) for (const earShape of ['pointed','floppy'] as const) for (const faceMark of ['none','whiteMuzzle'] as const) {
  const a = { ...defaultAppearance('dog'), coatPattern: 'bicolor' as const, earShape, faceMark, accentColor: 'black' as const };
  const g = composePixelFrame(f, a, 'dog');
  const patch = g.flatMap((row,y) => row.flatMap((c,x) => c === 't' ? [[x,y]] : []));
  assert(patch.length >= 4, `dog ${pose}:${f.index}/${earShape}/${faceMark}: bicolor patch exists`);
  assert(patch.every(([x,y]) => pose === 'walkSide' || pose === 'sleep' ? x >= 25 && y >= 16 : x < 24 && y < 28), `dog ${pose}:${f.index}: patch belongs to head, not tail`);
  assert(!g.some((row,y)=>row.some((c,x)=>!isPixelEye(pixelEyeRegions(f,'dog'),x,y)&&(c==='b'||c==='s'))), `dog ${pose}:${f.index}/${earShape}/${faceMark}: bicolor body is white outside eyes`);
}
for (const species of ['cat','dog'] as const) for (const pose of pixelPoses.filter(p => p !== 'walkBack')) for (const f of getPixelClip(species, pose)) for (const earShape of species === 'cat' ? ['pointed','folded','curled'] as const : ['pointed','floppy'] as const) for (const tail of ['long','short','fluffy'] as const) {
  const g = composePixelFrame(f, { ...defaultAppearance(species), earShape, tail, collar: 'red' }, species);
  const cells = g.flatMap((row,y) => row.flatMap((c,x) => c === 'bell' ? [[x,y]] : []));
  assert(cells.length === 4 && new Set(cells.map(([x]) => x)).size === 2 && new Set(cells.map(([,y]) => y)).size === 2, `${species}/${pose}:${f.index}/${earShape}/${tail}: complete 2x2 bell`);
  closed(g, `${species}/${pose}:${f.index}: accessorized outline`);
}
for (const earShape of earShapes) for (const tail of ['long','short','fluffy'] as const) {
  const a = normalizeAppearance({ earShape, tail }, 'other');
  const g = composePixelFrame(getPixelFrame('other'), a, 'other');
  assert(g.length === 48 && g.every(row => row.length === 48), 'all saved other ear/tail values render safely');
  assert(same(g, composePixelFrame(getPixelFrame('other'), defaultAppearance('other'), 'other')), 'other retains its single rounded silhouette');
}

// Addendum visual regressions, checked against original tip coordinates and final paint masks.
for (const pose of ['sit','blink','wave'] as const) for (const f of getPixelClip('cat', pose)) for (const earShape of ['folded','curled'] as const) {
  const g = composePixelFrame(f, { ...base, earShape });
  const top = pixelBounds(f.rows).top;
  f.rows[top]!.split('').forEach((c,x) => { if (c !== '.') assert(g[top]![x] === '.', `${pose}:${f.index}/${earShape}: old pointed tip removed`); });
}
for (const pose of ['sit','blink'] as const) for (const f of getPixelClip('dog', pose)) {
  assert(f.rows.slice(0,8).every(row => /^\.+$/.test(row)), `dog ${pose}:${f.index}: no old roof spikes`);
  assert([...f.rows[8]!].filter(c => c !== '.').length >= 8, 'dog crown starts with rounded wide roof, not a one-pixel spike');
}
for (const pose of pixelPoses) for (const f of getPixelClip('cat', pose)) {
  const g = composePixelFrame(f, { ...base, coatPattern: 'calico', collar: 'red' });
  g.forEach((row,y) => row.forEach((c,x) => { if (c === 'ginger' || c === 'black') assert([-1,0].some(dy => [-1,0].some(dx => [0,1].every(yy => [0,1].every(xx => g[y+dy+yy]?.[x+dx+xx] === c)))), `${pose}:${f.index}: calico patch belongs to a real 2x2 block`); }));
}
for (const pose of ['sit','blink','wave'] as const) for (const f of getPixelClip('cat', pose)) {
  for (let y=28;y<=34;y++) for (let x=28;x<40;x++) if (f.rows[y]![x] !== '.' && f.rows[y]![x+1] === '.') {
    const next = f.rows[y]!.indexOf('o', x+1);
    assert(!(next >= 34 && next-x <= 6), `${pose}:${f.index}: no background slit at shoulder/tail root`);
  }
}

// Blink must not move the collar/bell when the eye rows change.
for(const frame of [getPixelFrame('cat','sit'),...getPixelClip('cat','blink')]){
  const masks=appearancePixelMasks(frame,'cat');
  assert(pixelBounds(masks.collar.rows).top===31,'cat sit/blink collar stays at anatomical row31');
  assert(pixelBounds(masks.bell.rows).top===33,'cat sit/blink bell stays at anatomical row33');
}
