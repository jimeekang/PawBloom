import { createHookHarness } from "../testHookHarness";
declare const require: (name: string) => any;
const modules = require("node:module"), original = modules._load, react = require("react"), harness = createHookHarness();
modules._load = function(name: string, parent: unknown, main: boolean) { return name === "react" ? { ...react, ...harness.hooks } : original.call(this, name, parent, main); };
try {
  const { useHouseLayout } = require("./useHouseLayout");
  const reads: Array<(value: string | null) => void> = [], persisted: string[] = [];
  const storage = { getItem: () => new Promise<string | null>((resolve) => reads.push(resolve)), setItem: async (_: string, value: string) => { persisted.push(value); } };
  let user = "a", ids = ["p"];
  const render = () => harness.render(() => useHouseLayout(user, ids, 1, storage));
  let result = render(); result.movePet("p", { x: 0.7, y: 0.7 }); result = render(); reads[0]!(JSON.stringify({ version: 1, userId: "a", petId: "p", position: { x: 0.2, y: 0.2 } })); await flush(); assert(render().layout.p.x === 0.7, "late read cannot overwrite drag");
  user = "b"; result = render(); assert(result.layout.p.x === 0.5, "account switch immediately shows defaults"); reads[1]!(JSON.stringify({ version: 1, userId: "a", petId: "p", position: { x: 0.1, y: 0.1 } })); await flush(); assert(render().layout.p.x === 0.5, "foreign envelope cannot leak");
  ids = []; render(); result.movePet("p", { x: 0.1, y: 0.1 }); await flush(); assert(persisted.length === 1, "stale callback cannot persist removed pet"); harness.unmount();
} finally { modules._load = original; }
async function flush() { for (let i = 0; i < 6; i++) await Promise.resolve(); }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
