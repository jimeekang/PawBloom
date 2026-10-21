import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { clampHousePoint, type HousePoint } from "./houseLayout";
export type HouseLayoutStorage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
export const HOUSE_LAYOUT_VERSION = 1;
const encode = (value: string) => Array.from(value).map((char) => char.codePointAt(0)!.toString(16)).join("_");
export function houseLayoutStorageKey(userId: string, petId: string, version = HOUSE_LAYOUT_VERSION) { return `pawbloom.house.${version}.${encode(userId)}.${encode(petId)}`; }
export const houseLayoutStorage: HouseLayoutStorage = Platform.OS === "web" ? { getItem: async (key) => globalThis.localStorage?.getItem(key) ?? null, setItem: async (key, value) => { globalThis.localStorage?.setItem(key, value); } } : { getItem: SecureStore.getItemAsync, setItem: SecureStore.setItemAsync };
/** Identity/version validation prevents cross-account and stale-layout reuse. */
export function parseHousePosition(raw: string | null, userId: string, petId: string, version: number, fallback: HousePoint): HousePoint {
  try {
    const value = JSON.parse(raw ?? "null");
    if (value?.version !== version || value?.userId !== userId || value?.petId !== petId || !Number.isFinite(value?.position?.x) || !Number.isFinite(value?.position?.y)) return fallback;
    return clampHousePoint(value.position);
  } catch { return fallback; }
}
const writes = new WeakMap<HouseLayoutStorage, Map<string, Promise<void>>>();
/** Serial per-key writes ensure older writes cannot complete after newer positions. */
export function persistHousePosition(storage: HouseLayoutStorage, userId: string, petId: string, version: number, position: HousePoint): Promise<void> {
  let pending = writes.get(storage); if (!pending) { pending = new Map(); writes.set(storage, pending); }
  const key = houseLayoutStorageKey(userId, petId, version);
  const write = (pending.get(key) ?? Promise.resolve()).catch(() => undefined).then(() => storage.setItem(key, JSON.stringify({ version, userId, petId, position: clampHousePoint(position) }))).catch(() => undefined);
  pending.set(key, write); void write.finally(() => { if (pending!.get(key) === write) pending!.delete(key); });
  return write;
}
