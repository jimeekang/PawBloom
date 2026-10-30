import { characterColors } from "../../../design-system/tokens";
import type { Appearance } from "../domain/appearance";
import type { CharacterPaint } from "../domain/catCharacterGeometry";

export function characterPalette(a: Appearance): Record<CharacterPaint, string> {
  const faceColor = a.faceMark === "maskedEyes" ? "white" : a.coatPattern === "pointed" ? a.accentColor : a.coatColor;
  return {
    coat: characterColors.coat[a.coatColor], shade: characterColors.shade[a.coatColor], accent: characterColors.coat[a.accentColor],
    white: characterColors.coat.white, ginger: characterColors.coat.ginger, black: characterColors.coat.black,
    eyeLeft: characterColors.eye[a.eyeColor === "odd" ? "blue" : a.eyeColor], eyeRight: characterColors.eye[a.eyeColor === "odd" ? "amber" : a.eyeColor],
    eyeRing: faceColor === "black" || faceColor === "chocolate" ? characterColors.highlight : characterColors.ink,
    collar: characterColors.collar[a.collar], inner: characterColors.inner, nose: characterColors.nose, ink: characterColors.ink,
    highlight: characterColors.highlight, blush: characterColors.blush, bell: characterColors.bell, outline: characterColors.outline,
  };
}
