import { appearanceSchema, automaticAccent, changeAppearance, defaultAppearance, normalizeAppearance, presetAppearances, randomAppearance } from "./appearance";
import { characterGeometry } from "./dogCharacterGeometry";

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
for (const species of ["cat", "dog", "other"] as const) {
  assert(same(normalizeAppearance(null, species), defaultAppearance(species)), "null recovers defaults");
  assert(same(normalizeAppearance("bad", species), defaultAppearance(species)), "non-object recovers defaults");
  for (let seed = 0; seed < 80; seed++) {
    const result = randomAppearance(species, seed);
    assert(appearanceSchema.safeParse(result).success, "random obeys schema");
    assert(same(result, randomAppearance(species, seed)), "seed is deterministic");
    const geometry = characterGeometry(species, result);
    assert(Object.keys(geometry).length === 6, "six layers");
    assert(!JSON.stringify(geometry).includes("NaN"), "finite geometry");
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
const base = defaultAppearance();
for (const change of [{ build: "round" }, { tail: "short" }, { furLength: "long" }, { earShape: "folded" }, { coatPattern: "calico" }, { faceMark: "blaze" }, { collar: "red" }] as const) assert(!same(characterGeometry("cat", base), characterGeometry("cat", normalizeAppearance({ ...base, ...change }))), `geometry responds to ${JSON.stringify(change)}`);
assert(!same(characterGeometry("cat", base), characterGeometry("cat", base, true)), "smile only via explicit visual event");
const dog = defaultAppearance("dog");
assert(!same(characterGeometry("dog", dog), characterGeometry("dog", { ...dog, faceMark: "whiteMuzzle" })), "dog white muzzle is a visible choice");

for (const earShape of ["pointed", "floppy"] as const) {
  const solid = characterGeometry("dog", { ...dog, coatPattern: "solid", earShape });
  const bicolor = characterGeometry("dog", { ...dog, coatPattern: "bicolor", earShape });
  assert(solid.backEar[0]!.fill === "coat" && solid.head[0]!.fill === "coat", "solid dog ears match the coat, including the rear ear");
  assert(bicolor.backEar[0]!.fill === "accent" && bicolor.head[0]!.fill === "accent", "bicolor dog ears keep their contrasting accent");
}
