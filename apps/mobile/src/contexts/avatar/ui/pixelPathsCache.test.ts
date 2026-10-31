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
  const { characterPixelPaths } = require('./pixelPaths');
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
  console.log('Pixel path cache: hits compose 0 times.');
} finally { modules._load = original; }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
