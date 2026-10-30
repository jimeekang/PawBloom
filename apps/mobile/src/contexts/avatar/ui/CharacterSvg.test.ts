import { createHookHarness, findElements } from "../../../presentation/testHookHarness";
import { defaultAppearance } from "../domain/appearance";
import { characterColors } from "../../../design-system/tokens";
declare const require: (name: string) => any;
const modules = require("node:module"), original = modules._load, react = require("react"), rn = require("react-native");
let harness = createHookHarness(), nextId = 0;
class Value { interpolate(range: unknown) { return range; } }
const values = Object.fromEntries(["breathe", "blink", "tail", "ear", "wander", "direction", "bounce", "sit", "lift", "tap", "opacity", "jump", "reveal"].map((key) => [key, new Value()]));
modules._load = function(name: string, parent: unknown, main: boolean) {
  if (name === "react") return { ...react, ...Object.fromEntries(Object.keys(harness.hooks).map((key) => [key, (...args: any[]) => (harness.hooks as any)[key](...args)])), useId: () => harness.hooks.useMemo(() => `r:${++nextId}:`, []) };
  if (name === "react-native") return { ...rn, Animated: { multiply: (...args: unknown[]) => args, add: (...args: unknown[]) => args } };
  if (name === "react-native-svg") return { __esModule: true, default: "Svg", Path: "Path", Defs: "Defs", ClipPath: "ClipPath" };
  if (name.endsWith("/useCharacterMotion")) return { useCharacterMotion: () => ({ values, smiling: false, blushing: false }) };
  if (name.endsWith("/CharacterMotionView")) return { CharacterMotionView: "Motion" };
  return original.call(this, name, parent, main);
};
try {
  const { CharacterSvg } = require("./CharacterSvg");
  const props = { species: "cat", appearance: { ...defaultAppearance(), coatColor: "white", coatPattern: "calico", earShape: "folded" }, size: 68, withBody: true, motion: { id: "same/pet" } };
  const render = () => harness.render(() => CharacterSvg(props));
  const tree = render(), clips = (tree: any) => findElements(tree, (node) => node.type === "ClipPath").map((node) => node.props.id);
  assert(JSON.stringify(clips(tree)) === JSON.stringify(clips(render())), "clip IDs stay stable on rerender");
  assert(findElements(tree, (node) => node.type === "Svg").length === 6, "six existing animated SVG parts, no added motion layer");
  const parts = findElements(tree, (node) => node.type === "Motion" && node.props.testID !== "character-root" && node.props.testID);
  assert(parts.map((part) => part.props.testID).join() === "character-tail,character-body,character-backEar,character-head,character-eyes,character-frontPaws", "RN draws the twitching back ear before the head");
  const ear = parts.find((part) => part.props.testID === "character-backEar");
  const pivot = ear.props.style[1].transform;
  assert(pivot[1].translateX === -31 * 0.68 && pivot[2].translateY === (32 - 80) * 0.68 && ear.props.sources.includes(values.ear), "back ear keeps its original root pivot and twitch driver");
  for (const svg of findElements(tree, (node) => node.type === "Svg")) {
    const localClips = new Map<string, string>(findElements(svg, (node) => node.type === "ClipPath").map((node) => [node.props.id, node.props.children.props.d]));
    for (const part of findElements(svg, (node) => node.type === "Path" && node.props.clipPath)) assert(localClips.has(part.props.clipPath.slice(5, -1)), "RN clip reference resolves inside this exact SVG");
  }
  const contours = findElements(tree, (node) => node.type === "Path" && node.props.stroke === characterColors.outline);
  assert(contours.length > 4 && contours.every((node) => node.props.strokeWidth === 1.25 && node.props.vectorEffect === "non-scaling-stroke"), "light fur keeps 1.25px contours at room and avatar sizes");
  harness.unmount(); harness = createHookHarness();
  const second = render();
  assert(clips(second).every((id) => !clips(tree).includes(id)), "same pet in another avatar instance cannot reuse clip IDs");
  props.withBody = false;
  const head = render(); assert(findElements(head, (node) => node.type === "Svg").length === 3, "head-only avatars keep only head/ear/eyes");
  harness.unmount();
} finally { modules._load = original; }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
