import { createHookHarness } from "../../../presentation/testHookHarness";
declare const require: (name: string) => any;
const moduleApi = require("node:module"), original = moduleApi._load, react = require("react");
const harness = createHookHarness();
let started = 0, stopped = 0, stateUpdates = 0;
class Value { value: number; constructor(initial: number) { this.value = initial; } setValue(next: number) { this.value = next; } }
const animations: any[] = [];
const animation = (kind: string, children?: unknown) => { const item = { kind, children, running: false, start() { this.running = true; started++; }, stop() { if (this.running) { this.running = false; stopped++; } } }; animations.push(item); return item; };
moduleApi._load = function(name: string, parent: unknown, main: boolean) {
  if (name === "react") return { ...react, ...harness.hooks, useState: (initial: unknown) => { const [state, set] = harness.hooks.useState(initial); return [state, (next: unknown) => { stateUpdates++; set(next); }]; } };
  if (name === "react-native") return { Platform: { OS: "web" }, Easing: { inOut: (v: unknown) => v, quad: () => undefined }, Animated: { Value, delay: (ms: number) => animation("delay", ms), timing: (value: Value, options: unknown) => animation("timing", { value, options }), spring: (value: Value, options: unknown) => animation("spring", { value, options }), loop: (child: unknown) => animation("loop", child), sequence: (children: unknown) => animation("sequence", children), parallel: (children: unknown) => animation("parallel", children) } };
  return original.call(this, name, parent, main);
};
try {
  const { useCharacterMotion } = require("./useCharacterMotion");
  const sharedWander = new Value(0);
  const options = { id: "cat-a", enabled: true, paused: false, reduced: false, wanderOffset: sharedWander };
  const render = () => harness.render(() => useCharacterMotion(options));
  const result = render();
  assert(result.values.wander === sharedWander, "character and scene label use the same Animated.Value");
  assert(animations.filter((a) => a.kind === "loop" && a.running).length === 6, "all six idle loops start");
  assert(stateUpdates === 0, "starting idle never updates React state");
  const count = started;
  render(); assert(started === count, "stable render does not restart loops");
  result.values.wander.setValue(12); result.values.sit.setValue(1);
  options.paused = true; render();
  assert(result.values.wander.value === 0 && result.values.sit.value === 0, "drag/selection pauses and resets wander/sit");
  assert(sharedWander.value === 0, "drag/selection also resets the shared name offset");
  assert(animations.filter((a) => a.kind === "loop" && a.running).length === 4, "local idle remains during drag");
  options.paused = false; render(); sharedWander.setValue(12);
  options.enabled = false; render();
  assert(sharedWander.value === 0, "motion off returns character and name to the same anchor");
  assert(!animations.some((a) => a.kind === "loop" && a.running), "toggle off or background stops all idle loops");
  assert(result.values.blink.value === 1 && result.values.tail.value === 0 && result.values.breathe.value === 0, "neutral pose restored");
  options.enabled = true; render(); sharedWander.setValue(-16); options.reduced = true; render();
  assert(sharedWander.value === 0, "reduced motion resets the shared name offset");
  assert(!animations.some((a) => a.kind === "loop" && a.running), "OS reduction blocks all loops even if enabled is stale");
  options.reduced = false; render();
  assert(animations.filter((a) => a.kind === "loop" && a.running).length === 6, "resume starts loops");
  sharedWander.setValue(16); harness.unmount(); assert(!animations.some((a) => a.running) && sharedWander.value === 0, "unmount stops all loops and springs and resets the shared driver");
  assert(stopped > 6 && stateUpdates === 0, "idle lifecycle stays outside React state");
} finally { moduleApi._load = original; }
function assert(value: unknown, message: string): void { if (!value) throw new Error(message); }
