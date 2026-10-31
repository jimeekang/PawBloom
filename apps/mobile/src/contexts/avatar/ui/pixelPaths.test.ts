import { coatColors, coatPatterns, defaultAppearance } from '../domain/appearance';
import { composePixelFrame } from '../domain/pixelMasks';
import { getPixelClip, getPixelFrame, pixelPoses } from '../domain/pixelFrames';
import { pixelEyeRegions } from '../domain/pixelEyes';
import { characterPalette } from './characterPalette';
import { characterPixelPaths, pixelGridPaths } from './pixelPaths';
import { characterHeadCrop } from './characterHeadCrop';
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const base = defaultAppearance(), palette = characterPalette(base);
const run = pixelGridPaths([['b','b','s','o','k','m','.','b']], palette);
assert(run.length === 3, 'same resolved colors share one path, including o/k/m');
assert(run.find(p => p.fill === palette.b)!.d === 'M0 0h2v1h-2zM7 0h1v1h-1z', 'adjacent pixels form a single horizontal run; transparent gaps split runs');
assert(run.find(p => p.fill === palette.o)!.d === 'M3 0h3v1h-3z', 'distinct semantic slots merge after color resolution');
let maximum = 0, checked = 0;
for (const species of ['cat','dog','other'] as const) for (const pose of pixelPoses) for (const frame of getPixelClip(species, pose)) for (const coatPattern of coatPatterns) {
  // Deliberately pick distinct coat/shade/accent and odd/collar/bell to maximize actual colors.
  const a = { ...base, coatColor: 'brown' as const, accentColor: 'lilac' as const, coatPattern, eyeColor: 'odd' as const, collar: 'red' as const };
  const paths = characterPixelPaths(frame, a, species);
  maximum = Math.max(maximum, paths.length); checked++;
  assert(paths.length <= 14, `${species}/${pose}:${frame.index}/${coatPattern} exceeds path budget: ${paths.length}`);
  assert(new Set(paths.map(p => p.fill)).size === paths.length, 'one path per resolved color');
  assert(paths.every(p => /^(M\d+ \d+h\d+v1h-\d+z)+$/.test(p.d)), 'paths contain only integer pixel rectangles without strokes or curves');
}
for (const coatColor of coatColors) for (const earShape of ['pointed','folded','curled'] as const) for (const tail of ['long','short','fluffy'] as const) {
  const a = { ...base, coatColor, earShape, tail, eyeColor: 'odd' as const, collar: 'blue' as const, coatPattern: 'tabby' as const, accentColor: 'ginger' as const };
  assert(characterPixelPaths(getPixelFrame('cat'), a).length <= 14, 'silhouette options preserve the worst-case color budget');
}
const head = characterPixelPaths(getPixelFrame('cat'), base, 'cat', false);
const ys = head.flatMap(p => [...p.d.matchAll(/M\d+ (\d+)h/g)].map(match => Number(match[1])));
assert(ys.length > 0 && Math.max(...ys) === characterHeadCrop('cat').rows - 1, 'head paths stop exactly at the chin row of the crop');
console.log(`Pixel paths: ${checked} clip/pattern combinations, maximum ${maximum}/14 paths.`);

// Eye ROIs come from the domain eye registry, so redrawn eyes move the test with the data.
let irisChecks = 0;
for (const species of ['cat','dog','other'] as const) for (const pose of species === 'cat' ? pixelPoses : species === 'dog' ? ['sit','blink','walkSide','sleep'] as const : ['sit'] as const) for (const f of getPixelClip(species, pose)) {
  // Closed eyes (sleep, blink/wave/stretch closed frames) have no iris band to paint.
  // Side views register one eye (side 'right'); front views two. Each keeps its own left/right paint.
  const rois = pixelEyeRegions(f, species).filter(region => region.kind !== 'closed');
  if (!rois.length) continue;
  for (const eyeColor of ['amber','blue','odd'] as const) {
    const a = { ...defaultAppearance(species), eyeColor }, paints = composePixelFrame(f, a, species), palette = characterPalette(a);
    rois.forEach(({ left: l, top: t, right: r, bottom: b, side }) => {
      const irisColors: string[] = [];
      for (let y=t; y<=b; y++) for (let x=l; x<=r; x++) if (f.rows[y]![x] === 'i') {
        const paint = paints[y]![x];
        assert(paint === (side === 'left' ? 'eyeLeft' : 'eyeRight'), `${species}/${pose}:${f.index}: one whole iris keeps its left/right identity`);
        irisColors.push(palette[paint]);
      }
      const wanted = eyeColor === 'odd' && side === 'right' ? characterPalette({ ...a, eyeColor: 'amber' }).eyeLeft : palette.eyeLeft;
      assert(irisColors.length >= 2 && irisColors.every(color => color === wanted), `${species}/${pose}:${f.index}/${eyeColor}: selected eyeColor paints the complete iris band`);
      irisChecks++;
    });
  }
}
assert(irisChecks >= 60, `registry covers the front-facing open eyes (${irisChecks} iris checks)`);
console.log(`Eye ROIs from registry: ${irisChecks} iris bands checked.`);
