import { normalizeAppearance, presetAppearances, type Appearance, type CharacterSpecies } from "../domain/appearance";
import { appearanceStorageKey, parseStoredAppearance, type AppearanceStorage } from "../domain/appearanceStorage";
import { localAppearanceStorage } from "../infrastructure/localAppearanceStorage";

export function previewAppearance(petId: string, species: CharacterSpecies): Appearance {
  const index = ({ "pet-demo-mochi": 0, "pet-demo-luna": 4, "pet-demo-cheese": 0, "pet-demo-coco": 2 } as Record<string, number>)[petId];
  return index === undefined ? normalizeAppearance(null, species) : presetAppearances(species)[index];
}
export async function readAppearance(userId: string | null, petId: string, species: CharacterSpecies, storage = localAppearanceStorage): Promise<Appearance> {
  if (!userId) return previewAppearance(petId, species);
  return parseStoredAppearance(await storage.getItem(appearanceStorageKey(userId, petId)), userId, petId, species);
}
const writes = new WeakMap<AppearanceStorage, Map<string, Promise<Appearance>>>();
/** Commit the cache only after durable success; failures retain the previous appearance. */
export function saveAppearance(userId: string | null, petId: string, species: CharacterSpecies, input: Appearance, storage = localAppearanceStorage): Promise<Appearance> {
  const appearance = normalizeAppearance(input, species);
  if (!userId) return Promise.resolve(appearance);
  let pending = writes.get(storage); if (!pending) { pending = new Map(); writes.set(storage, pending); }
  const key = appearanceStorageKey(userId, petId);
  const write = (pending.get(key) ?? Promise.resolve()).catch(() => undefined).then(async () => {
    await storage.setItem(key, JSON.stringify({ version: 1, userId, petId, appearance }));
    return appearance;
  });
  pending.set(key, write);
  const clear = () => { if (pending!.get(key) === write) pending!.delete(key); };
  void write.then(clear, clear);
  return write;
}
