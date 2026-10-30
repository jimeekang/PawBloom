import type { TranslationKey } from "../../../i18n/translations";
import type { AppearanceField } from "../domain/appearance";

export const appearanceLabels: Record<AppearanceField, TranslationKey> = {
  coatColor: "character.coatColor",
  coatPattern: "character.coatPattern",
  eyeColor: "character.eyeColor",
  earShape: "character.earShape",
  furLength: "character.furLength",
  build: "character.build",
  tail: "character.tail",
  faceMark: "character.faceMark",
  collar: "character.collar",
  accentColor: "character.accentColor",
};
export const appearanceOptions: Record<AppearanceField, readonly { value: string; label: TranslationKey }[]> = {
  coatColor: [{ value: "white", label: "character.coatColor.white" }, { value: "cream", label: "character.coatColor.cream" }, { value: "ginger", label: "character.coatColor.ginger" }, { value: "brown", label: "character.coatColor.brown" }, { value: "gray", label: "character.coatColor.gray" }, { value: "black", label: "character.coatColor.black" }, { value: "lilac", label: "character.coatColor.lilac" }, { value: "chocolate", label: "character.coatColor.chocolate" }],
  coatPattern: [{ value: "solid", label: "character.coatPattern.solid" }, { value: "tabby", label: "character.coatPattern.tabby" }, { value: "bicolor", label: "character.coatPattern.bicolor" }, { value: "calico", label: "character.coatPattern.calico" }, { value: "pointed", label: "character.coatPattern.pointed" }, { value: "tabbyWhite", label: "character.coatPattern.tabbyWhite" }],
  eyeColor: [{ value: "amber", label: "character.eyeColor.amber" }, { value: "green", label: "character.eyeColor.green" }, { value: "blue", label: "character.eyeColor.blue" }, { value: "copper", label: "character.eyeColor.copper" }, { value: "odd", label: "character.eyeColor.odd" }],
  earShape: [{ value: "pointed", label: "character.earShape.pointed" }, { value: "folded", label: "character.earShape.folded" }, { value: "curled", label: "character.earShape.curled" }, { value: "floppy", label: "character.earShape.floppy" }],
  furLength: [{ value: "short", label: "character.furLength.short" }, { value: "long", label: "character.furLength.long" }],
  build: [{ value: "slim", label: "character.build.slim" }, { value: "regular", label: "character.build.regular" }, { value: "round", label: "character.build.round" }],
  tail: [{ value: "long", label: "character.tail.long" }, { value: "short", label: "character.tail.short" }, { value: "fluffy", label: "character.tail.fluffy" }],
  faceMark: [{ value: "none", label: "character.faceMark.none" }, { value: "blaze", label: "character.faceMark.blaze" }, { value: "maskedEyes", label: "character.faceMark.maskedEyes" }, { value: "whiteMuzzle", label: "character.faceMark.whiteMuzzle" }],
  collar: [{ value: "none", label: "character.collar.none" }, { value: "red", label: "character.collar.red" }, { value: "blue", label: "character.collar.blue" }, { value: "yellow", label: "character.collar.yellow" }, { value: "green", label: "character.collar.green" }],
  accentColor: [{ value: "white", label: "character.coatColor.white" }, { value: "cream", label: "character.coatColor.cream" }, { value: "ginger", label: "character.coatColor.ginger" }, { value: "brown", label: "character.coatColor.brown" }, { value: "gray", label: "character.coatColor.gray" }, { value: "black", label: "character.coatColor.black" }, { value: "lilac", label: "character.coatColor.lilac" }, { value: "chocolate", label: "character.coatColor.chocolate" }],
};
export const presetLabels: Record<"cat" | "dog", TranslationKey[]> = {
  cat: ["character.preset.cat0", "character.preset.cat1", "character.preset.cat2", "character.preset.cat3", "character.preset.cat4", "character.preset.cat5"],
  dog: ["character.preset.dog0", "character.preset.dog1", "character.preset.dog2", "character.preset.dog3", "character.preset.dog4", "character.preset.dog5"],
};
