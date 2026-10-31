import { coatColors, defaultAppearance, eyeColors } from '../domain/appearance';
import { pixelSlots } from '../domain/pixelFrames';
import { characterColors } from '../../../design-system/tokens';
import { characterPalette } from './characterPalette';
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
for (const coatColor of coatColors) for (const eyeColor of eyeColors) {
  const a = { ...defaultAppearance(), coatColor, eyeColor }, p = characterPalette(a);
  assert(pixelSlots.filter(slot => slot !== '.').every(slot => p[slot]), 'every opaque source slot resolves');
  assert(p.b === characterColors.coat[coatColor] && p.s === characterColors.shade[coatColor], 'base and 15% shade come from selected coat tokens');
  assert(p.t === characterColors.coat[a.accentColor], 'tabby/point accent uses selected token');
  assert(p.o === characterColors.pixelOutline && p.k === p.o && p.m === p.o, 'contours, eyes and linework share dark plum without extra paths');
  assert(p.e === characterColors.pixelEarInner && p.p === characterColors.pixelPaw && p.h === characterColors.pixelHighlight, 'pixel materials use dedicated tokens');
  assert(p.n === characterColors.nose && p.w === characterColors.coat.white && p.W === characterColors.shade.white, 'fixed white and nose remain independent of coat');
  assert(p.eyeLeft === characterColors.eye[eyeColor === 'odd' ? 'blue' : eyeColor] && p.eyeRight === characterColors.eye[eyeColor === 'odd' ? 'amber' : eyeColor], 'odd iris colors are left blue / right amber');
}
for (const collar of ['red','blue','yellow','green'] as const) {
  const p = characterPalette({ ...defaultAppearance(), collar });
  assert(p.collar === characterColors.collar[collar] && p.bell === characterColors.bell, 'collar and bell map to their tokens');
}
