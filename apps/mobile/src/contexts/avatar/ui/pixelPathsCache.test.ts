import { defaultAppearance } from '../domain/appearance';
import { getPixelClip, getPixelFrame } from '../domain/pixelFrames';
declare const require: (name: string) => any;
const modules = require('node:module'), original = modules._load;
let composed = 0;
/** Read through a function: assertions must not let TypeScript narrow the counter to a literal. */
const calls = () => composed;
modules._load = function(name: string, parent: unknown, main: boolean) {
  const loaded = original.call(this, name, parent, main);
  if (name.endsWith('/pixelMasks')) return { ...loaded, composePixelFrame: (...args: unknown[]) => { composed++; return loaded.composePixelFrame(...args); } };
  return loaded;
};
try {
  const { characterPixelPaths, pixelPathCacheSize, PIXEL_PATH_CACHE_LIMIT } = require('./pixelPaths');
  const blink = getPixelClip('cat', 'blink');
  const first = blink.map((frame) => characterPixelPaths(frame, defaultAppearance('cat'), 'cat', true));
  assert(calls() === 4, `first blink composes each frame once (${calls()})`);
  composed = 0;
  // A new but equal appearance object (re-render, DefaultPetCharacter default) and reordered keys still hit.
  const reordered = Object.fromEntries(Object.entries(defaultAppearance('cat')).reverse());
  const again = blink.map((frame) => characterPixelPaths(frame, reordered, 'cat', true));
  assert(calls() === 0 && again.every((paths, i) => paths === first[i]), 'cache hit: zero compose calls and identical paths on a clip switch back');
  characterPixelPaths(getPixelFrame('cat'), defaultAppearance('cat'), 'cat', false);
  assert(calls() === 1, 'head crop is its own entry');
  characterPixelPaths(getPixelFrame('cat'), { ...defaultAppearance('cat'), eyeColor: 'blue' }, 'cat', true);
  assert(calls() === 2, 'a different appearance composes again');
  characterPixelPaths(getPixelFrame('dog'), defaultAppearance('dog'), 'dog', true); characterPixelPaths(getPixelFrame('dog'), defaultAppearance('dog'), 'dog', true);
  assert(calls() === 3, 'species is part of the key and hits on repeat');
  // Global bound: entries across all frames and crops share one LRU, not a per-frame cap.
  const { coatColors, eyeColors, collars } = require('../domain/appearance');
  const entries: Array<() => unknown> = [];
  for (const coatColor of coatColors) for (const eyeColor of eyeColors) for (const collar of collars) for (const body of [true, false]) {
    const frame = blink[entries.length % blink.length], look = { ...defaultAppearance('cat'), coatColor, eyeColor, collar };
    entries.push(() => characterPixelPaths(frame, look, 'cat', body));
  }
  assert(entries.length === 400 && PIXEL_PATH_CACHE_LIMIT === 256, 'fixture overflows the 256-entry limit');
  const prior = pixelPathCacheSize();
  entries.slice(0, 300).forEach((load) => load());
  assert(pixelPathCacheSize() === 256 && prior < 256, `total entries stay at the global limit (${pixelPathCacheSize()})`);
  composed = 0; entries[299]!();
  assert(calls() === 0, 'the most recent entry is still cached');
  entries[0]!();
  assert(calls() === 1 && pixelPathCacheSize() === 256, 'the oldest entry was evicted and recomposes without growing the cache');
  // Survivors are 45..299 then 0. Touching 45 makes 46 the least recently used.
  composed = 0; entries[45]!(); entries[300]!();
  assert(calls() === 1, 'a recently used entry hits; only the new one composes');
  composed = 0; entries[45]!(); entries[46]!();
  assert(calls() === 1, 'least-recently-used order: the touched entry stays, the next-oldest was evicted');
  console.log('Pixel path cache: hits compose 0 times; 256-entry global LRU bound.');
} finally { modules._load = original; }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
