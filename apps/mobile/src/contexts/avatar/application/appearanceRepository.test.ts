import { getPixelFrame } from "../domain/pixelFrames";
import { characterPixelPaths } from "../ui/pixelPaths";
import { defaultAppearance } from "../domain/appearance";
import { appearanceStorageKey, parseStoredAppearance, type AppearanceStorage } from "../domain/appearanceStorage";
import { readAppearance, saveAppearance } from "./appearanceRepository";

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const data = new Map<string, string>();
const storage: AppearanceStorage = { getItem: async (key) => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); } };
const base = defaultAppearance("cat"), red = { ...base, collar: "red" as const };
await saveAppearance("account-a", "pet-a", "cat", red, storage);
assert((await readAppearance("account-a", "pet-a", "cat", storage)).collar === "red", "saved fields restore");
assert((await readAppearance("account-b", "pet-a", "cat", storage)).collar === "none", "account isolation");
assert((await readAppearance("account-a", "pet-b", "cat", storage)).collar === "none", "pet isolation");
const raw = data.get(appearanceStorageKey("account-a", "pet-a"))!;
assert(parseStoredAppearance(raw, "account-b", "pet-a", "cat").collar === "none", "payload identity also checked");
assert(parseStoredAppearance("invalid-json", "account-a", "pet-a", "cat").version === 1, "corruption recovers");
assert(appearanceStorageKey("a.b", "c") !== appearanceStorageKey("a", "b.c"), "unambiguous keys");
const failing = { ...storage, setItem: async () => { throw new Error("disk full"); } };
let failed = false; try { await saveAppearance("account-a", "pet-a", "cat", base, failing); } catch { failed = true; }
assert(failed && (await readAppearance("account-a", "pet-a", "cat", storage)).collar === "red", "failure surfaces and preserves previous value");
let finish!: () => void, started = 0;
const ordered: AppearanceStorage = { ...storage, setItem: async (key, value) => { if (++started === 1) await new Promise<void>((resolve) => { finish = resolve; }); data.set(key, value); } };
const first = saveAppearance("a", "p", "cat", red, ordered), last = saveAppearance("a", "p", "cat", { ...base, collar: "blue" }, ordered);
await Promise.resolve(); await Promise.resolve();
assert(started === 1, "writes are serialized"); finish(); await Promise.all([first, last]);
assert((await readAppearance("a", "p", "cat", storage)).collar === "blue", "last write wins");
let previewWrites = 0;
await saveAppearance(null, "preview", "cat", base, { ...storage, setItem: async () => { previewWrites++; } });
assert(previewWrites === 0, "preview never persists under an account");

const oldV2 = { ...base, version: 1 as const, furLength: "long" as const, build: "round" as const, earShape: "folded" as const, eyeColor: "odd" as const };
await saveAppearance("existing-owner", "v2-pet", "cat", oldV2, storage);
const restoredV2 = await readAppearance("existing-owner", "v2-pet", "cat", storage);
assert(JSON.stringify(restoredV2) === JSON.stringify(oldV2), "durable v2 payload restores without schema migration or field loss");
assert(characterPixelPaths(getPixelFrame("cat"), restoredV2).length > 0, "restored v2 fur/build payload renders through the actual pixel path builder");
