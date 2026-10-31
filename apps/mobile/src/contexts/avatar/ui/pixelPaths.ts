import type { Appearance, CharacterSpecies } from '../domain/appearance';
import type { PixelFrame } from '../domain/pixelFrames';
import { composePixelFrame, type PixelPaintGrid, type PixelPaint } from '../domain/pixelMasks';
import { characterPalette } from './characterPalette';
import { characterHeadCrop, maskCharacterHead } from './characterHeadCrop';

export type PixelPath = { fill: string; d: string };
/** Merge horizontal runs by resolved color, including semantic slots sharing one token. */
export function pixelGridPaths(grid: PixelPaintGrid, palette: Record<PixelPaint, string>, height = 48): PixelPath[] {
  const paths = new Map<string, string[]>();
  grid.slice(0, height).forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const slot = row[x]!;
      if (slot === '.') { x++; continue; }
      const fill = palette[slot], start = x++;
      while (x < row.length && row[x] !== '.' && palette[row[x] as PixelPaint] === fill) x++;
      const width = x - start;
      if (!paths.has(fill)) paths.set(fill, []);
      paths.get(fill)!.push(`M${start} ${y}h${width}v1h-${width}z`);
    }
  });
  return [...paths].map(([fill, commands]) => ({ fill, d: commands.join('') }));
}
/** Order-independent value key: equal appearances share cache entries even when built as new objects. */
export function characterAppearanceKey(appearance: Appearance) {
  return Object.keys(appearance).sort().map((key) => `${key}:${String(appearance[key as keyof Appearance])}`).join('|');
}
const MAX_ENTRIES_PER_FRAME = 64;
const pathCache = new WeakMap<PixelFrame, Map<string, PixelPath[]>>();
/**
 * Composition runs once per frame × species × crop × appearance. Clip switches (blink, walk, wave) and
 * re-renders reuse the paths; frames are static objects, so the WeakMap never pins them. Callers must not mutate.
 */
export function characterPixelPaths(frame: PixelFrame, appearance: Appearance, species: CharacterSpecies = 'cat', withBody = true): PixelPath[] {
  let byFrame = pathCache.get(frame);
  if (!byFrame) { byFrame = new Map(); pathCache.set(frame, byFrame); }
  const key = `${species}/${withBody ? 'body' : 'head'}/${characterAppearanceKey(appearance)}`, hit = byFrame.get(key);
  if (hit) return hit;
  const grid = composePixelFrame(frame, appearance, species);
  const paths = withBody ? pixelGridPaths(grid, characterPalette(appearance), 48) : pixelGridPaths(maskCharacterHead(grid, species), characterPalette(appearance), characterHeadCrop(species).rows);
  if (byFrame.size >= MAX_ENTRIES_PER_FRAME) byFrame.clear(); // random-button churn stays bounded
  byFrame.set(key, paths);
  return paths;
}
