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
/** Total entries across every frame, species, crop and appearance (≈30 frames × 2 crops × a few pets). */
export const PIXEL_PATH_CACHE_LIMIT = 256;
const frameIds = new WeakMap<PixelFrame, number>();
let nextFrameId = 0;
const pathCache = new Map<string, PixelPath[]>();
/**
 * Composition runs once per frame × species × crop × appearance. Clip switches (blink, walk, wave) and
 * re-renders reuse the paths. One least-recently-used map bounds the total, so random-button churn in the
 * builder cannot grow memory per frame. Frames are keyed by a WeakMap id, never pinned. Callers must not mutate.
 */
export function characterPixelPaths(frame: PixelFrame, appearance: Appearance, species: CharacterSpecies = 'cat', withBody = true): PixelPath[] {
  let frameId = frameIds.get(frame);
  if (frameId === undefined) { frameId = nextFrameId++; frameIds.set(frame, frameId); }
  const key = `${frameId}/${species}/${withBody ? 'body' : 'head'}/${characterAppearanceKey(appearance)}`, hit = pathCache.get(key);
  if (hit) { pathCache.delete(key); pathCache.set(key, hit); return hit; } // refresh recency (Map keeps insertion order)
  const grid = composePixelFrame(frame, appearance, species);
  const paths = withBody ? pixelGridPaths(grid, characterPalette(appearance), 48) : pixelGridPaths(maskCharacterHead(grid, species), characterPalette(appearance), characterHeadCrop(species).rows);
  if (pathCache.size >= PIXEL_PATH_CACHE_LIMIT) pathCache.delete(pathCache.keys().next().value!);
  pathCache.set(key, paths);
  return paths;
}
/** Test/diagnostic hook: current entry count. */
export function pixelPathCacheSize() { return pathCache.size; }
