import { appearanceSchema, automaticAccent, changeAppearance, defaultAppearance, normalizeAppearance, presetAppearances, randomAppearance } from "./appearance";


const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
for (const species of ["cat", "dog", "other"] as const) {
  assert(same(normalizeAppearance(null, species), defaultAppearance(species)), "null recovers defaults");
  assert(same(normalizeAppearance("bad", species), defaultAppearance(species)), "non-object recovers defaults");
  for (let seed = 0; seed < 80; seed++) {
    const result = randomAppearance(species, seed);
    assert(appearanceSchema.safeParse(result).success, "random obeys schema");
    assert(same(result, randomAppearance(species, seed)), "seed is deterministic");
  }
  assert(presetAppearances(species).length === 6, "six presets");
}
assert(new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(randomAppearance("cat", i)))).size === 20, "seeds vary");
assert(new Set(presetAppearances("cat").map((a) => JSON.stringify(a))).size === 6, "presets distinct");
assert(normalizeAppearance({ species: "dog", coatColor: "gray", eyeColor: "unknown", collar: "blue", version: 93 }).collar === "blue", "valid fields survive unknown version/fields");
assert(!("species" in normalizeAppearance({ species: "dog" })), "pet is species source");
assert(normalizeAppearance({ earShape: "floppy" }, "cat").earShape === "pointed", "cat ear recovery");
assert(normalizeAppearance({ earShape: "curled", coatPattern: "calico" }, "dog").coatPattern === "solid", "dog restricted patterns");
for (const [color, accent] of [["white", "cream"], ["cream", "ginger"], ["ginger", "brown"], ["gray", "black"], ["black", "chocolate"], ["lilac", "chocolate"]] as const) assert(automaticAccent(color, "tabby") === accent, `tabby ${color}`);
const pointed = normalizeAppearance({ coatPattern: "pointed", coatColor: "black" });
assert(pointed.coatColor === "cream" && pointed.accentColor === "chocolate" && pointed.eyeColor === "blue", "pointed defaults");
assert(normalizeAppearance({ coatPattern: "calico" }).faceMark === "whiteMuzzle", "calico muzzle default");
assert(normalizeAppearance({ coatPattern: "pointed", accentColor: "gray", eyeColor: "green" }).accentColor === "gray", "explicit accent survives restore");
const tabby = presetAppearances("cat")[0];
assert(changeAppearance(tabby, "coatColor", "gray", "cat", false).accentColor === "black", "coat change recalculates automatic accent");
assert(changeAppearance({ ...tabby, accentColor: "lilac" }, "coatColor", "gray", "cat", true).accentColor === "lilac", "explicit accent survives subsequent changes");
assert(automaticAccent("ginger", "tabbyWhite") === "white", "tabby-white never automatically introduces a third coat color");
for (const faceMark of ["none", "blaze", "maskedEyes", "whiteMuzzle"] as const) {
  const restored = normalizeAppearance({ version: 1, faceMark, coatPattern: "bicolor" });
  for (const pattern of ["solid", "tabby", "bicolor", "calico", "pointed", "tabbyWhite"]) assert(changeAppearance(restored, "coatPattern", pattern, "cat", false).faceMark === faceMark, "all existing v1 face choices survive every pattern change without a schema migration");
}
// Existing v2 payloads stay version 1, including renderer-inactive fur/build choices.
const savedV2 = { ...defaultAppearance(), furLength: "long", build: "round", tail: "fluffy", eyeColor: "odd" };
assert(same(normalizeAppearance(JSON.parse(JSON.stringify(savedV2))), savedV2), "v2 appearance restores without migration or dropping fields");
