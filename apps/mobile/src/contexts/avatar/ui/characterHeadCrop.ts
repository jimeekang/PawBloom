import type { CharacterSpecies } from '../domain/appearance';
import { pixelEyeRegions } from '../domain/pixelEyes';
import { getPixelFrame } from '../domain/pixelFrames';
import type { PixelPaint, PixelPaintGrid } from '../domain/pixelMasks';

export type CharacterHeadCrop = Readonly<{
  /** Rows 0..rows-1 of the sit frame: ears, the whole eye stamp, muzzle and the chin outline. */
  rows: number;
  /** Face columns kept on each crop row (inclusive); shoulders, back and tail outside are not drawn. */
  spans: readonly (readonly [number, number])[];
  /** Cut points on each row where body pixels were removed; drawn as outline so the face edge stays closed. */
  closures: readonly (readonly number[])[];
  /** Face pixel bounds inside the crop, in logical pixels (right/bottom exclusive). */
  left: number; top: number; right: number; bottom: number;
  /** Circle centred on the face bounds that holds every kept pixel corner. */
  centerX: number; centerY: number; radius: number;
}>;
const MAX_CHIN_SEARCH = 8;
const cache = new Map<CharacterSpecies, CharacterHeadCrop>();

/**
 * Derived from the sit frame, never fixed rows: the chin is where the face outline under the eyes stops
 * stepping inward (round silhouettes fall back to the row under the mouth line). The face width is the
 * silhouette of the ear/eye rows; below the eyes the face is mirrored around its centre, so anything outside
 * that mirrored outline is body.
 */
export function characterHeadCrop(species: CharacterSpecies): CharacterHeadCrop {
  const cached = cache.get(species);
  if (cached) return cached;
  const frame = getPixelFrame(species, 'sit'), rows = frame.rows;
  const eyes = pixelEyeRegions(frame, species);
  const eyeBottom = eyes.length ? Math.max(...eyes.map((eye) => eye.bottom)) : 25;
  const leftEdge = (y: number) => rows[y]!.search(/[^.]/);
  const rightEdge = (y: number) => { const row = rows[y]!; for (let x = row.length - 1; x >= 0; x--) if (row[x] !== '.') return x; return -1; };
  let chin = -1;
  for (let y = eyeBottom + 1; y < Math.min(rows.length - 1, eyeBottom + 1 + MAX_CHIN_SEARCH); y++) {
    if (leftEdge(y) >= 0 && leftEdge(y) > leftEdge(y - 1) && leftEdge(y + 1) < leftEdge(y)) { chin = y; break; }
  }
  if (chin < 0) {
    let mouth = eyeBottom;
    for (let y = eyeBottom + 1; y <= Math.min(rows.length - 1, eyeBottom + MAX_CHIN_SEARCH); y++) if (/[mn]/.test(rows[y]!)) mouth = y;
    chin = Math.min(rows.length - 1, mouth + 1);
  }
  const count = chin + 1;
  let faceLeft = 48, faceRight = -1;
  for (let y = 0; y <= eyeBottom; y++) if (leftEdge(y) >= 0) { faceLeft = Math.min(faceLeft, leftEdge(y)); faceRight = Math.max(faceRight, rightEdge(y)); }
  const mirror = faceLeft + faceRight;
  const spans: [number, number][] = [], closures: number[][] = [];
  for (let y = 0; y < count; y++) {
    const span: [number, number] = y <= eyeBottom || leftEdge(y) < 0 ? [faceLeft, faceRight] : [Math.max(faceLeft, leftEdge(y)), Math.min(faceRight, mirror - leftEdge(y))];
    const cuts: number[] = [];
    if (leftEdge(y) >= 0 && leftEdge(y) < span[0]) cuts.push(span[0]);
    if (rightEdge(y) > span[1]) cuts.push(span[1]);
    // The chin row sits on the body: where the body continues underneath, the cut becomes the jaw outline.
    if (y === count - 1 && y + 1 < rows.length) for (let x = span[0]; x <= span[1]; x++) if (rows[y]![x] !== '.' && rows[y + 1]![x] !== '.' && !cuts.includes(x)) cuts.push(x);
    spans.push(span); closures.push(cuts);
  }
  let left = 48, top = 48, right = 0, bottom = 0;
  const kept: [number, number][] = [];
  for (let y = 0; y < count; y++) for (let x = spans[y]![0]; x <= spans[y]![1]; x++) if (rows[y]![x] !== '.' || closures[y]!.includes(x)) {
    kept.push([x, y]); left = Math.min(left, x); right = Math.max(right, x + 1); top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
  }
  const centerX = (left + right) / 2, centerY = (top + bottom) / 2;
  let radius = 0;
  for (const [x, y] of kept) for (const [px, py] of [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]] as const) radius = Math.max(radius, Math.hypot(px - centerX, py - centerY));
  const crop = { rows: count, spans, closures, left, top, right, bottom, centerX, centerY, radius };
  cache.set(species, crop);
  return crop;
}

/** Render-only face mask: data frames are untouched; body pixels outside the face span disappear and the cut edge gets outline. */
export function maskCharacterHead(grid: PixelPaintGrid, species: CharacterSpecies): PixelPaintGrid {
  const crop = characterHeadCrop(species);
  return grid.slice(0, crop.rows).map((row, y) => row.map((paint, x): PixelPaint | '.' => {
    const [from, to] = crop.spans[y]!;
    if (x < from || x > to) return '.';
    return crop.closures[y]!.includes(x) ? 'o' : paint;
  }));
}
