import { defaultAppearance } from '../domain/appearance';
import { pixelEyeRegions } from '../domain/pixelEyes';
import { getPixelFrame } from '../domain/pixelFrames';
import { composePixelFrame } from '../domain/pixelMasks';
import { characterHeadCrop, maskCharacterHead } from './characterHeadCrop';
declare const require: (name: string) => any;
const modules = require('node:module'), original = modules._load;
modules._load = function(name: string, parent: unknown, main: boolean) {
  if (name.endsWith('/CharacterSvg')) return { CharacterSvg: 'CharacterSvg' };
  return original.call(this, name, parent, main);
};
try {
  const { characterHeadLayout } = require('./CharacterHeadAvatar');
  for (const species of ['cat', 'dog', 'other'] as const) {
    const crop = characterHeadCrop(species), frame = getPixelFrame(species, 'sit'), rows = frame.rows.slice(0, crop.rows);
    const eyes = pixelEyeRegions(frame, species);
    assert(eyes.length === 2 && eyes.every((eye) => eye.bottom < crop.rows), `${species}: the whole eye stamp is inside the head crop`);
    assert(eyes.every((eye) => crop.rows - 1 - eye.bottom >= 3), `${species}: muzzle and chin rows sit below the eyes, not the eye's last row`);
    const below = frame.rows.slice(Math.max(...eyes.map((eye) => eye.bottom)) + 1);
    if (below.some((row) => row.includes('n'))) assert(rows.some((row) => row.includes('n')), `${species}: nose is inside the crop`);
    const chinRow = frame.rows[crop.rows - 1]!, nextRow = frame.rows[crop.rows]!, edge = (row: string) => row.search(/[^.]/);
    assert(/[om]/.test(chinRow[edge(chinRow)]!), `${species}: the crop's last row is the jaw outline`);
    if (species !== 'other') assert(edge(nextRow) < edge(chinRow), `${species}: the row below the chin widens into the body, so the jaw is not cut`);
    else assert(rows.some((row) => row.includes('m')), 'other: the mouth line is inside the crop');
    assert(crop.rows >= 28 && crop.rows <= 34, `${species}: crop is about the top 31 rows (got ${crop.rows})`);
    // Face-only: nothing painted outside the face width or the mirrored jaw outline; the face is centred in the circle.
    const masked = maskCharacterHead(composePixelFrame(frame, { ...defaultAppearance(species), tail: 'fluffy' }, species), species);
    let faceLeft = 48, faceRight = -1;
    for (let y = 0; y <= Math.max(...eyes.map((eye) => eye.bottom)); y++) { const row = frame.rows[y]!, l = row.search(/[^.]/); if (l >= 0) { faceLeft = Math.min(faceLeft, l); faceRight = Math.max(faceRight, row.length - 1 - [...row].reverse().join('').search(/[^.]/)); } }
    masked.forEach((row, y) => row.forEach((paint, x) => { if (paint !== '.') assert(x >= faceLeft && x <= faceRight && x >= crop.spans[y]![0] && x <= crop.spans[y]![1], `${species}: (${x},${y}) is body outside the face and must not be drawn`); }));
    crop.closures.forEach((cuts, y) => cuts.forEach((x) => assert(masked[y]![x] === 'o', `${species}: row ${y} cut edge is closed with outline`)));
    for (const size of [24, 36, 44, 48, 52]) {
      const layout = characterHeadLayout(species, size), centre = size / 2 - 1;
      const faceX = layout.left + (crop.left + crop.right) / 2 * layout.scale, faceY = layout.top + (crop.top + crop.bottom) / 2 * layout.scale;
      assert(Math.abs(faceX - centre) <= 1 && Math.abs(faceY - centre) <= 1, `${species} at ${size}px: the face bbox centre sits within 1px of the circle centre`);
    }
    // Circle fit: every painted corner of the composed head (all ear shapes) stays inside the border at real avatar sizes.
    for (const size of [24, 36, 44, 48, 52]) for (const earShape of species === 'cat' ? ['pointed', 'folded', 'curled'] as const : ['pointed', 'floppy'] as const) {
      const appearance = { ...defaultAppearance(species), earShape, collar: 'red' as const };
      const paints = maskCharacterHead(composePixelFrame(frame, appearance, species), species), layout = characterHeadLayout(species, size), inner = size / 2 - 1, centre = size / 2 - 1;
      let worst = -Infinity;
      paints.slice(0, crop.rows).forEach((row, y) => row.forEach((paint, x) => {
        if (paint === '.') return;
        for (const [px, py] of [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]) worst = Math.max(worst, Math.hypot(layout.left + px! * layout.scale - centre, layout.top + py! * layout.scale - centre) - inner);
      }));
      assert(worst <= 0, `${species}/${earShape} at ${size}px: ear tips, whiskers and chin stay inside the circle (overflow ${worst.toFixed(2)}px)`);
    }
  }
  console.log(`Head crop rows: cat ${characterHeadCrop('cat').rows}, dog ${characterHeadCrop('dog').rows}, other ${characterHeadCrop('other').rows}; circle fit 24–52px.`);
} finally { modules._load = original; }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
