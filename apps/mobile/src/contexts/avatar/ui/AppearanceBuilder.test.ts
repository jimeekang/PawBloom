import { createHookHarness, findElements } from "../../../presentation/testHookHarness";
import { characterColors } from "../../../design-system/tokens";
import { defaultAppearance } from "../domain/appearance";
import { t } from "../../../i18n/translations";
declare const require: (name: string) => any;
const modules = require("node:module"), original = modules._load, react = require("react"), rn = require("react-native");
let harness = createHookHarness(), closed = 0, fail = true;
const preview = () => null, button = () => null, notice = () => null;
let saved: any;
modules._load = function(name: string, parent: unknown, main: boolean) {
  if (name === "react") return { ...react, ...Object.fromEntries(Object.keys(harness.hooks).map((key) => [key, (...args: any[]) => (harness.hooks as any)[key](...args)])) };
  if (name === "react-native") return { ...rn, useWindowDimensions: () => ({ width: 360, height: 640 }) };
  if (name.endsWith("/CharacterSvg")) return { CharacterSvg: preview };
  if (name.endsWith("/components")) return { PrimaryButton: button, NoticeBanner: notice };
  return original.call(this, name, parent, main);
};
try {
  const { AppearanceBuilder } = require("./AppearanceBuilder");
  const props = { pet: { id: "cat", name: "열두글자이름을사용하는아이", breed: "", species: "cat" }, initialAppearance: defaultAppearance(), motionEnabled: false, reducedMotion: true, onboarding: true, onClose: () => closed++, onSave: async (appearance: unknown) => { if (fail) throw new Error("storage full"); saved = appearance; } };
  const render = () => harness.render(() => AppearanceBuilder(props));
  let tree = render();
  choice(tree, t("character.color")).props.onPress(); tree = render();
  assert(!findElements(tree, (node) => node.props?.group === t("character.accentColor")).length, "solid hides the unused accent choices");
  const gray = choice(tree, t("character.coatColor.gray"), t("character.coatColor"));
  const renderedGray = gray.type(gray.props);
  assert(renderedGray.props.accessibilityRole === "button" && renderedGray.props.accessibilityState.selected === true && renderedGray.props.accessibilityLabel.includes(t("character.selected")), "swatches have names and selected state");
  choice(tree, t("character.coatColor.ginger"), t("character.coatColor")).props.onPress(); tree = render();
  assert(findElements(tree, (node) => node.type === preview && node.props.withBody)[0].props.appearance.coatColor === "ginger", "preview changes immediately");
  choice(tree, t("character.eyes")).props.onPress(); tree = render();
  const odd = choice(tree, t("character.eyeColor.odd"), t("character.eyeColor"));
  const oddTree = odd.type(odd.props);
  const swatchColors = findElements(oddTree, (node) => node.props?.style).flatMap((node) => [node.props.style].flat().map((style) => style?.backgroundColor));
  assert(swatchColors.includes(characterColors.eye.blue) && swatchColors.includes(characterColors.eye.amber), "odd eyes show both eye colors in the swatch");
  odd.props.onPress(); tree = render();
  assert(choice(tree, t("character.eyeColor.odd"), t("character.eyeColor")).props.selected, "two-color swatch retains selection semantics");
  choice(tree, t("character.faceCollar")).props.onPress(); tree = render();
  choice(tree, t("character.faceMark.blaze"), t("character.faceMark")).props.onPress(); tree = render();
  for (const pattern of ["bicolor", "tabbyWhite", "solid", "tabby"] as const) {
    choice(tree, t("character.pattern")).props.onPress(); tree = render();
    choice(tree, t(`character.coatPattern.${pattern}`), t("character.coatPattern")).props.onPress(); tree = render();
    assert(findElements(tree, (node) => node.type === preview && node.props.withBody)[0].props.appearance.faceMark === "blaze", "pattern changes preserve a deliberately selected face mark");
    choice(tree, t("character.color")).props.onPress(); tree = render();
    const accents = findElements(tree, (node) => node.props?.group === t("character.accentColor"));
    assert(accents.length === (pattern === "tabby" ? 8 : 0), "only editable accent groups are shown for cats");
  }
  choice(tree, t("character.faceCollar")).props.onPress(); tree = render();
  const blaze = choice(tree, t("character.faceMark.blaze"), t("character.faceMark"));
  assert(blaze.type(blaze.props).props.accessibilityState.selected && blaze.type(blaze.props).props.accessibilityLabel.includes(t("character.selected")), "preserved face choice remains named and selected for accessibility");
  findElements(tree, (node) => node.type === button)[0].props.onPress(); await Promise.resolve(); await Promise.resolve(); tree = render();
  assert(!saved && !closed && findElements(tree, (node) => node.type === notice && node.props.text === t("character.saveFailed")).length === 1, "failed save keeps editor and reports error");
  assert(!findElements(tree, (node) => node.type === button)[0].props.disabled, "failed save can retry");
  fail = false; findElements(tree, (node) => node.type === button)[0].props.onPress(); await Promise.resolve(); await Promise.resolve();
  assert(saved.coatColor === "ginger" && saved.faceMark === "blaze" && closed === 1, "reduced motion saves exact choices and returns without reveal delay");
  harness.unmount(); harness = createHookHarness(); props.pet.species = "dog";
  tree = render(); choice(tree, t("character.pattern")).props.onPress(); tree = render();
  choice(tree, t("character.coatPattern.bicolor"), t("character.coatPattern")).props.onPress(); tree = render();
  choice(tree, t("character.color")).props.onPress(); tree = render();
  assert(findElements(tree, (node) => node.props?.group === t("character.accentColor")).length === 8, "dog bicolor keeps editable accent colors");
  harness.unmount(); harness = createHookHarness(); props.pet.species = "other";
  tree = render();
  assert(!findElements(tree, (node) => node.props?.group === t("character.accentColor")).length, "other hides unsupported accent");
  choice(tree, t("character.faceCollar")).props.onPress(); tree = render();
  assert(!findElements(tree, (node) => node.props?.group === t("character.faceMark")).length, "other hides unsupported face marks");
  const skip = findElements(tree, (node) => node.props?.children?.props?.children === t("character.skip"))[0];
  assert(skip, "onboarding provides skip"); skip.props.onPress(); assert(closed === 2, "skip returns without another save");
  harness.unmount();
} finally { modules._load = original; }
function choice(tree: any, label: string, group?: string) { const result = findElements(tree, (node) => node.type?.name === "Choice" && node.props.label === label && (!group || node.props.group === group))[0]; if (!result) throw new Error(`Missing choice ${label}`); return result; }
function assert(value: unknown, message: string): void { if (!value) throw new Error(message); }
