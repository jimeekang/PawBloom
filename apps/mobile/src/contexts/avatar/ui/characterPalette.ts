import { characterColors } from '../../../design-system/tokens';
import type { Appearance } from '../domain/appearance';
import type { PixelPaint } from '../domain/pixelMasks';

/** Semantic paint values stay color-free in domain; only this boundary resolves tokens. */
export function characterPalette(a: Appearance): Record<PixelPaint, string> {
  const eyes = a.eyeColor === 'odd' ? ['blue', 'amber'] as const : [a.eyeColor, a.eyeColor] as const;
  return {
    o: characterColors.pixelOutline, k: characterColors.pixelOutline, m: characterColors.pixelOutline,
    b: characterColors.coat[a.coatColor], s: characterColors.shade[a.coatColor], t: characterColors.coat[a.accentColor],
    w: characterColors.coat.white, W: characterColors.shade.white, e: characterColors.pixelEarInner,
    i: characterColors.eye[eyes[0]], eyeLeft: characterColors.eye[eyes[0]], eyeRight: characterColors.eye[eyes[1]],
    h: characterColors.pixelHighlight, n: characterColors.nose, p: characterColors.pixelPaw,
    ginger: characterColors.coat.ginger, black: characterColors.coat.black,
    cream: characterColors.coat.cream, creamShade: characterColors.shade.cream,
    collar: characterColors.collar[a.collar], bell: characterColors.bell,
  };
}
