import { coatColors, defaultAppearance, eyeColors } from "../domain/appearance";
import { characterGeometry } from "../domain/dogCharacterGeometry";
import { characterColors } from "../../../design-system/tokens";
import { characterPalette } from "./characterPalette";

// 3:1 separates a non-text outline from its adjacent coat, even for amber on ginger.
for (const species of ["cat", "dog"] as const) for (const coatColor of coatColors) for (const eyeColor of eyeColors) for (const faceMark of ["none", "maskedEyes"] as const) {
  const a = { ...defaultAppearance(species), coatColor, eyeColor, faceMark }, palette = characterPalette(a);
  assert(contrast(palette.eyeRing, faceMark === "maskedEyes" ? palette.white : palette.coat) >= 3, `${species} ${coatColor}/${eyeColor}/${faceMark}: iris ring contrasts with its actual background`);
  assert([characterColors.ink, characterColors.highlight].some((color) => color === palette.eyeRing), "ring reuses character color tokens");
  const irises = characterGeometry(species, a).eyes.filter((part) => part.fill === "eyeLeft" || part.fill === "eyeRight");
  assert(irises.length === 2 && irises.every((part) => part.stroke === "eyeRing" && part.strokeWidth! >= 1.5), "both irises actually render the contrast ring");
}
for (const accentColor of coatColors) {
  const palette = characterPalette({ ...defaultAppearance(), coatColor: "cream", coatPattern: "pointed", accentColor });
  assert(contrast(palette.eyeRing, palette.accent) >= 3, "pointed eye ring follows face color rather than cream body");
  const masked = characterPalette({ ...defaultAppearance(), coatPattern: "pointed", accentColor, faceMark: "maskedEyes" });
  assert(contrast(masked.eyeRing, masked.white) >= 3, "white eye masks take precedence over pointed face color");
}
function luminance(hex: string) {
  const rgb = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
}
function contrast(a: string, b: string) { const light = luminance(a), dark = luminance(b); return (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05); }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
