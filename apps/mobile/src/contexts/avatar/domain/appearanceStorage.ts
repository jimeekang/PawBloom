import { normalizeAppearance, type Appearance, type CharacterSpecies } from "./appearance";

export type AppearanceStorage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
const encode = (value: string) => Array.from(value).map((char) => char.codePointAt(0)!.toString(16)).join("_");
export function appearanceStorageKey(userId: string, petId: string) { return `pawbloom.appearance.1.${encode(userId)}.${encode(petId)}`; }
export function parseStoredAppearance(raw: string | null, userId: string, petId: string, species: CharacterSpecies): Appearance {
  try {
    const data = JSON.parse(raw ?? "null");
    return normalizeAppearance(data?.version === 1 && data?.userId === userId && data?.petId === petId ? data.appearance : null, species);
  } catch { return normalizeAppearance(null, species); }
}
