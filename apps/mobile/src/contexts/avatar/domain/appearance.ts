import { z } from "zod";

export type CharacterSpecies = "cat" | "dog" | "other";
export const coatColors = ["white", "cream", "ginger", "brown", "gray", "black", "lilac", "chocolate"] as const;
export const coatPatterns = ["solid", "tabby", "bicolor", "calico", "pointed", "tabbyWhite"] as const;
export const eyeColors = ["amber", "green", "blue", "copper", "odd"] as const;
export const earShapes = ["pointed", "folded", "curled", "floppy"] as const;
export const furLengths = ["short", "long"] as const;
export const builds = ["slim", "regular", "round"] as const;
export const tails = ["long", "short", "fluffy"] as const;
export const faceMarks = ["none", "blaze", "maskedEyes", "whiteMuzzle"] as const;
export const collars = ["none", "red", "blue", "yellow", "green"] as const;
export const appearanceSchema = z.object({
  version: z.literal(1), coatColor: z.enum(coatColors), coatPattern: z.enum(coatPatterns),
  accentColor: z.enum(coatColors), eyeColor: z.enum(eyeColors), earShape: z.enum(earShapes),
  furLength: z.enum(furLengths), build: z.enum(builds), tail: z.enum(tails),
  faceMark: z.enum(faceMarks), collar: z.enum(collars),
});
export type Appearance = z.infer<typeof appearanceSchema>;
export type AppearanceField = Exclude<keyof Appearance, "version">;

export function automaticAccent(coatColor: Appearance["coatColor"], pattern: Appearance["coatPattern"]): Appearance["accentColor"] {
  if (pattern === "pointed") return "chocolate";
  if (pattern === "calico") return "ginger";
  if (pattern === "tabbyWhite") return "white";
  if (pattern === "tabby") {
    return ({ white: "cream", cream: "ginger", ginger: "brown", gray: "black" } as const)[coatColor as "white" | "cream" | "ginger" | "gray"] ?? "chocolate";
  }
  return coatColor === "black" ? "gray" : "black";
}

export function defaultAppearance(species: CharacterSpecies = "cat"): Appearance {
  const coatColor = species === "cat" ? "gray" : "cream";
  return { version: 1, coatColor, coatPattern: "solid", accentColor: automaticAccent(coatColor, "solid"), eyeColor: "amber", earShape: species === "dog" ? "floppy" : "pointed", furLength: "short", build: "regular", tail: "long", faceMark: "none", collar: "none" };
}

/** Recover fields independently; persisted species is deliberately ignored. */
export function normalizeAppearance(input: unknown, species: CharacterSpecies = "cat"): Appearance {
  const defaults = defaultAppearance(species);
  const record = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof Appearance)[]) {
    const parsed = appearanceSchema.shape[key].safeParse(record[key]);
    if (parsed.success) Object.assign(result, { [key]: parsed.data });
  }
  if (species !== "cat" && !["solid", "bicolor"].includes(result.coatPattern)) result.coatPattern = "solid";
  if (species === "dog" && !["pointed", "floppy"].includes(result.earShape)) result.earShape = "floppy";
  if (species === "cat" && result.earShape === "floppy") result.earShape = "pointed";
  if (!appearanceSchema.shape.accentColor.safeParse(record.accentColor).success) result.accentColor = automaticAccent(result.coatColor, result.coatPattern);
  if (result.coatPattern === "pointed") {
    result.coatColor = "cream";
    if (!appearanceSchema.shape.eyeColor.safeParse(record.eyeColor).success) result.eyeColor = "blue";
  }
  if (["calico", "bicolor", "tabbyWhite"].includes(result.coatPattern) && !appearanceSchema.shape.faceMark.safeParse(record.faceMark).success) result.faceMark = "whiteMuzzle";
  return result;
}

/** Builder tracks an explicit accent choice until reset/preset/random. */
export function changeAppearance(current: Appearance, field: AppearanceField, value: string, species: CharacterSpecies, accentExplicit: boolean): Appearance {
  const next = { ...current, [field]: value };
  if ((field === "coatColor" || field === "coatPattern") && !accentExplicit) next.accentColor = automaticAccent(next.coatColor, next.coatPattern);
  if (field === "coatPattern") {
    if (value === "pointed") { next.coatColor = "cream"; next.eyeColor = "blue"; }
    // Existing face marks (including restored v1 choices) survive pattern changes.
  }
  return normalizeAppearance(next, species);
}

export function presetAppearances(species: CharacterSpecies): Appearance[] {
  const cats: Partial<Appearance>[] = [
    { coatColor: "ginger", coatPattern: "tabby" },
    { coatColor: "black", coatPattern: "bicolor" },
    { coatColor: "white", coatPattern: "calico" },
    { coatPattern: "pointed" },
    { coatColor: "gray", eyeColor: "green" },
    { coatColor: "white", furLength: "long", tail: "fluffy", eyeColor: "odd" },
  ];
  const dogs: Partial<Appearance>[] = [
    { coatColor: "cream", earShape: "pointed", tail: "fluffy" },
    { coatColor: "brown", earShape: "floppy" },
    { coatColor: "white", coatPattern: "bicolor", accentColor: "black" },
    { coatColor: "black", faceMark: "whiteMuzzle" },
    { coatColor: "ginger", earShape: "pointed", faceMark: "blaze" },
    { coatColor: "chocolate", coatPattern: "bicolor", accentColor: "cream" },
  ];
  return (species === "cat" ? cats : dogs).map((preset) => normalizeAppearance(preset, species));
}

export function hashSeed(id: string): number {
  let value = 0;
  for (const char of id) value = (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0;
  return value;
}
export function randomAppearance(species: CharacterSpecies, seed: number): Appearance {
  let state = seed >>> 0;
  function pick<T>(items: readonly T[]): T { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return items[Math.floor((state / 4294967296) * items.length)]; }
  return normalizeAppearance({ coatColor: pick(coatColors), coatPattern: pick(species === "cat" ? coatPatterns : ["solid", "bicolor"]), eyeColor: pick(eyeColors), earShape: pick(species === "cat" ? earShapes.slice(0, 3) : ["pointed", "floppy"]), furLength: pick(furLengths), build: pick(builds), tail: pick(tails), faceMark: pick(faceMarks), collar: pick(collars) }, species);
}
