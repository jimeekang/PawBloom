import { createHookHarness } from "../testHookHarness";
declare const require: (name: string) => any;
const moduleApi = require("node:module"), original = moduleApi._load, react = require("react");
const harness = createHookHarness(); let appListener: (value: string) => void, motionListener: (value: boolean) => void, initial!: (value: boolean) => void, removed = 0;
moduleApi._load = function(name: string, parent: unknown, main: boolean) {
  if (name === "react") return { ...react, ...harness.hooks };
  if (name === "react-native") return { AppState: { currentState: "active", addEventListener: (_: string, listener: any) => { appListener = listener; return { remove: () => removed++ }; } }, AccessibilityInfo: { addEventListener: (_: string, listener: any) => { motionListener = listener; return { remove: () => removed++ }; }, isReduceMotionEnabled: () => new Promise<boolean>((resolve) => { initial = resolve; }) } };
  return original.call(this, name, parent, main);
};
try {
  const { isHouseMotionEnabled, useHouseMotionEnabled, useHouseMotionState } = require("./useHouseMotionEnabled");
  for (const visible of [false, true]) for (const active of [false, true]) for (const reduced of [false, true]) for (const paused of [false, true]) assert(isHouseMotionEnabled({ tabVisible: visible, appState: active ? "active" : "background", reduceMotion: reduced, userPaused: paused }) === (visible && active && !reduced && !paused), "truth matrix");
  const render = () => harness.render(() => useHouseMotionEnabled(true, false));
  const state = () => harness.render(() => useHouseMotionState(true, false));
  assert(!render() && !state().settled, "OS unknown fails closed and is not settled, so one-shot reactions wait");
  motionListener!(false); assert(render() && state().settled && !state().reduced, "OS event enables and settles"); initial(true); await Promise.resolve(); assert(render(), "late initial preference cannot override newer event");
  appListener!("background"); assert(!render(), "background pauses"); appListener!("active"); assert(render(), "foreground resumes");
  harness.unmount(); assert(removed === 2, "both listeners removed");
} finally { moduleApi._load = original; }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
