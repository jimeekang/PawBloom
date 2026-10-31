import { createHookHarness, findElements } from "../../../presentation/testHookHarness";
declare const require: (name: string) => any;
const modules = require("node:module"), original = modules._load, react = require("react");
let harness = createHookHarness();
modules._load = function(name: string, parent: unknown, main: boolean) {
  if (name === "react") return { ...react, ...Object.fromEntries(Object.keys(harness.hooks).map((key) => [key, (...args: any[]) => (harness.hooks as any)[key](...args)])) };
  if (name === "react-native-svg") return { __esModule: true, default: "Svg", Defs: "Defs", LinearGradient: "LinearGradient", Rect: "Rect", Stop: "Stop" };
  return original.call(this, name, parent, main);
};
try {
  const { ChipScrollRow } = require("./ChipScrollRow");
  let tree = harness.render(() => ChipScrollRow({ children: "chips", bleed: 16 }));
  const fades = () => findElements(tree, (node) => node.type?.name === "Fade").map((node) => node.props.side).join(",");
  const scroll = () => findElements(tree, (node) => node.props?.horizontal)[0];
  assert(tree.props.style.marginHorizontal === -16 && scroll().props.contentContainerStyle.flat().some((style: any) => style?.paddingHorizontal === 16), "row bleeds to the screen edge and keeps the first chip aligned");
  scroll().props.onLayout({ nativeEvent: { layout: { width: 375 } } }); scroll().props.onContentSizeChange(420);
  tree = harness.render(() => ChipScrollRow({ children: "chips", bleed: 16 }));
  assert(fades() === "end", "overflowing row fades only the side with hidden chips");
  scroll().props.onScroll({ nativeEvent: { contentOffset: { x: 20 } } }); tree = harness.render(() => ChipScrollRow({ children: "chips", bleed: 16 }));
  assert(fades() === "start,end", "mid-scroll shows both fades");
  scroll().props.onScroll({ nativeEvent: { contentOffset: { x: 45 } } }); tree = harness.render(() => ChipScrollRow({ children: "chips", bleed: 16 }));
  assert(fades() === "start", "the last chip is reachable and the end fade clears");
  scroll().props.onContentSizeChange(300); scroll().props.onScroll({ nativeEvent: { contentOffset: { x: 0 } } }); tree = harness.render(() => ChipScrollRow({ children: "chips", bleed: 16 }));
  assert(fades() === "", "a row that fits has no fade");
  scroll().props.onContentSizeChange(420); scroll().props.onScroll({ nativeEvent: { contentOffset: { x: 20 } } }); tree = harness.render(() => ChipScrollRow({ children: "chips", bleed: 16 }));
  const ids = findElements(tree, (node) => node.type?.name === "Fade").map((node) => node.props.id);
  assert(new Set(ids).size === 2 && ids.every((id: string) => /^chip-fade-\d+-(start|end)$/.test(id)), "each fade has its own gradient id");
  harness.unmount(); harness = createHookHarness();
  tree = harness.render(() => ChipScrollRow({ children: "chips", bleed: 16 }));
  scroll().props.onLayout({ nativeEvent: { layout: { width: 375 } } }); scroll().props.onContentSizeChange(420); scroll().props.onScroll({ nativeEvent: { contentOffset: { x: 20 } } });
  tree = harness.render(() => ChipScrollRow({ children: "chips", bleed: 16 }));
  const second = findElements(tree, (node) => node.type?.name === "Fade").map((node) => node.props.id);
  assert(second.length === 2 && second.every((id: string) => !ids.includes(id)), "a second row (pose + tab rows on one screen) never reuses the first row's gradient ids");
  harness.unmount();
} finally { modules._load = original; }
function assert(value: unknown, message: string): void { if (!value) throw new Error(message); }
