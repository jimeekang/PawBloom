import { coatColors, defaultAppearance, presetAppearances, randomAppearance } from "./appearance";
import { characterLayers, type CharacterPath } from "./catCharacterGeometry";
import { characterGeometry } from "./dogCharacterGeometry";

for (const coatPattern of ["bicolor", "tabbyWhite"] as const) for (const coatColor of coatColors) {
  const a = { ...defaultAppearance(), coatPattern, coatColor };
  const geometry = characterGeometry("cat", a);
  assert(!Object.values(geometry).flat().some((part) => part.fill === "accent"), "two-color cats never draw a third-color accent patch");
  for (const accentColor of coatColors) assert(JSON.stringify(geometry) === JSON.stringify(characterGeometry("cat", { ...a, accentColor })), "ignored accent cannot change two-color cat geometry or contours");
}
assert(characterLayers.indexOf("backEar") < characterLayers.indexOf("head"), "twitching back ear is painted behind the forehead");
for (const species of ["cat", "dog"] as const) for (const earShape of species === "cat" ? ["folded", "curled", "pointed"] as const : ["floppy", "pointed"] as const) {
  const g = characterGeometry(species, { ...defaultAppearance(species), earShape });
  const left = bounds(sample(g.backEar.find((part) => part.feature === "earLeft")!.d));
  const right = bounds(sample(g.head.find((part) => part.feature === "earRight")!.d));
  assert(Math.abs(left.width - right.width) < 0.1 && Math.abs(left.height - right.height) < 0.1, `${species} ${earShape}: ear silhouettes have symmetric size`);
  const headIndex = g.head.findIndex((part) => part.feature === "head");
  assert(g.head.findIndex((part) => part.feature === "earRight") < headIndex && g.head.every((part, index) => part.feature !== "earInner" || index < headIndex), "forehead covers both ear roots and their light-coat borders");
}
for (const earShape of ["pointed", "floppy"] as const) {
  const g = characterGeometry("dog", { ...defaultAppearance("dog"), coatPattern: "bicolor", earShape });
  const patches = g.head.filter((part) => part.feature === "marking" && part.fill === "accent");
  assert(patches.length === 1, "dog bicolor keeps exactly one contrasting head patch");
  const patch = bounds(sample(patches[0]!.d));
  for (const eye of g.eyes.filter((part) => part.fill === "eyeLeft" || part.fill === "eyeRight")) {
    const ellipse = eye.d.match(/^M([\d.]+),([\d.]+)a([\d.]+),([\d.]+)/)!;
    const [x, y, rx, ry] = ellipse.slice(1).map(Number), stroke = (eye.strokeWidth ?? 0) / 2;
    assert(patch.minX > x + 2 * rx + stroke || patch.maxX < x - stroke || patch.maxY < y - ry - stroke || patch.minY > y + ry + stroke, "dog patch bounds do not touch either iris or its ring");
  }
}

for (const earShape of ["folded", "curled", "pointed"] as const) {
  const g = characterGeometry("cat", { ...defaultAppearance(), earShape });
  for (const layer of [g.backEar, g.head]) {
    const inner = layer.find((part) => part.fill === "inner")!, outline = layer[0]!;
    assert(inner && sample(inner.d).every((point) => inside(point, sample(outline.d))), `${earShape}: pink ear stays inside its own ear silhouette`);
    assert(inner.clip === outline.d, `${earShape}: ear inner shares the matching clip`);
  }
}
for (const species of ["cat", "dog", "other"] as const) {
  const appearances = [...presetAppearances(species), ...Array.from({ length: 60 }, (_, seed) => randomAppearance(species, seed))];
  for (const appearance of appearances) {
    const g = characterGeometry(species, appearance);
    assert(Object.keys(g).length === 6 && characterLayers.every((layer) => Array.isArray(g[layer])), "geometry stays inside the six motion layers");
    for (const layer of characterLayers) for (const part of g[layer]) {
      if (part.feature === "marking" || part.fill === "inner") assert(part.clip, "every marking/ear inner carries a silhouette clip");
      if (part.clip) assert(g[layer].some((base) => base.d === part.clip && base.feature !== "marking"), "clip belongs to a silhouette in this same motion layer");
    }
  }
  for (const coatColor of ["white", "cream"] as const) {
    const g = characterGeometry(species, { ...defaultAppearance(species), coatColor });
    for (const layer of ["head", "backEar", "body", "tail", "frontPaws"] as const) assert(g[layer].some((part) => part.stroke === "outline" && part.strokeWidth! >= 1 && part.strokeWidth! <= 1.5 && part.nonScalingStroke), `${species} ${coatColor}: ${layer} has a visible fixed-width contour`);
  }
}
const longCat = characterGeometry("cat", { ...defaultAppearance(), furLength: "long" });
for (const layer of ["head", "body"] as const) {
  const silhouette = longCat[layer].find((part) => part.feature === layer)!;
  assert(silhouette && /[QC]/.test(silhouette.d) && !/[Ll]/.test(silhouette.d), "long fur outline uses smooth lobes, not zigzag line segments");
}
const dog = defaultAppearance("dog"), dogGeometry = characterGeometry("dog", { ...dog, earShape: "pointed" });
const muzzle = dogGeometry.head.find((part) => part.feature === "muzzle");
assert(muzzle && !characterGeometry("cat", defaultAppearance()).head.some((part) => part.feature === "muzzle"), "dog has a separate projecting muzzle silhouette");
assert(dogGeometry.backEar.filter((part) => part.fill === "inner").length === 1 && dogGeometry.head.filter((part) => part.fill === "inner").length === 1, "pointed dog has two matching pink ear inners");
for (const layer of [dogGeometry.backEar, dogGeometry.head]) assert(sample(layer.find((part) => part.fill === "inner")!.d).every((point) => inside(point, sample(layer[0]!.d))), "dog ear inner fits the matching outer ear");
const tails = ["long", "short", "fluffy"].map((tail) => characterGeometry("dog", { ...dog, tail: tail as typeof dog.tail }).tail[0]!.d);
assert(new Set(tails).size === 3, "dog has three distinct tail silhouettes");
for (const tail of ["long", "short", "fluffy"] as const) assert(characterGeometry("dog", { ...dog, tail }).tail[0]!.d !== characterGeometry("cat", { ...defaultAppearance(), tail }).tail[0]!.d, "dog tail never reuses the thin cat silhouette");
const catEyes = characterGeometry("cat", defaultAppearance()).eyes;
assert(JSON.stringify(catEyes) !== JSON.stringify(dogGeometry.eyes), "dog eye spacing and round shapes differ from the cat");

type Point = { x: number; y: number };
function bounds(points: Point[]) {
  const minX = Math.min(...points.map((p) => p.x)), maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y)), maxY = Math.max(...points.map((p) => p.y));
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}
/** Sample the absolute M/L/Q/C/Z ear curves; test actual containment, not just bounding boxes. */
function sample(d: CharacterPath["d"]): Point[] {
  const tokens = d.match(/[MLQCZ]|-?\d+(?:\.\d+)?/g)!;
  const points: Point[] = []; let i = 0, current = { x: 0, y: 0 }, start = current;
  const read = () => ({ x: Number(tokens[i++]), y: Number(tokens[i++]) });
  while (i < tokens.length) {
    const command = tokens[i++];
    if (command === "Z") { points.push(start); current = start; continue; }
    if (command === "M" || command === "L") { current = read(); if (command === "M") start = current; points.push(current); continue; }
    assert(command === "Q" || command === "C", "ear test supports only absolute curve commands");
    const from = current, control = read(), second = command === "C" ? read() : null, end = read();
    for (let step = 1; step <= 32; step++) {
      const t = step / 32, s = 1 - t;
      const axis = (key: "x" | "y") => second ? s ** 3 * from[key] + 3 * s ** 2 * t * control[key] + 3 * s * t ** 2 * second[key] + t ** 3 * end[key] : s ** 2 * from[key] + 2 * s * t * control[key] + t ** 2 * end[key];
      points.push({ x: axis("x"), y: axis("y") });
    }
    current = end;
  }
  return points;
}
function inside(point: Point, polygon: Point[]) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!, b = polygon[j]!;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
}
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
