import { clampHousePoint, createDefaultHouseLayout } from "./houseLayout";
import { houseLayoutStorageKey, parseHousePosition, persistHousePosition } from "./houseLayoutStorage";
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
for (const count of [0, 1, 3, 6, 17]) {
  const ids = Array.from({ length: count }, (_, i) => `pet-${i}`), layout = createDefaultHouseLayout(ids);
  assert(Object.keys(layout).length === count, "supports 0/1/3/6/n");
  assert(JSON.stringify(layout) === JSON.stringify(createDefaultHouseLayout([...ids].reverse())), "deterministic ID order");
  assert(Object.values(layout).every((point) => point.x >= 0.08 && point.x <= 0.92 && point.y >= 0.08 && point.y <= 0.92), "safe normalized positions");
}
assert(createDefaultHouseLayout(["a"]).a!.x === 0.5, "one pet centered");
assert(clampHousePoint({ x: NaN, y: Infinity }).x === 0.5 && clampHousePoint({ x: -1, y: 3 }).y === 0.92, "nonfinite recovery and clamp");
assert(clampHousePoint({ x: 0, y: 0 }, { minX: 4, maxX: -1, minY: NaN, maxY: 1 }).x === 0.08, "invalid bounds recover");
assert(houseLayoutStorageKey("ab", "c") !== houseLayoutStorageKey("a", "bc") && houseLayoutStorageKey("a.b", "c") !== houseLayoutStorageKey("a", "b.c"), "account/pet encoding has no key collisions");
const fallback = { x: 0.5, y: 0.5 };
for (const raw of [null, "{", JSON.stringify({ version: 2, userId: "u", petId: "p", position: { x: 0.1, y: 0.2 } }), JSON.stringify({ version: 1, userId: "other", petId: "p", position: { x: 0.1, y: 0.2 } })]) assert(parseHousePosition(raw, "u", "p", 1, fallback) === fallback, "corrupt/version/account mismatch defaults");
let finish!: () => void; const writes: string[] = [];
const storage = { getItem: async () => null, setItem: async (_key: string, value: string) => { writes.push(value); if (writes.length === 1) await new Promise<void>((resolve) => { finish = resolve; }); } };
const first = persistHousePosition(storage, "u", "p", 1, { x: 0.2, y: 0.2 });
const second = persistHousePosition(storage, "u", "p", 1, { x: 0.8, y: 0.8 });
for (let i = 0; i < 5; i++) await Promise.resolve();
assert(writes.length === 1, "second write waits for older write"); finish(); await Promise.all([first, second]);
assert(JSON.parse(writes[1]!).position.x === 0.8, "newest write persists last");
