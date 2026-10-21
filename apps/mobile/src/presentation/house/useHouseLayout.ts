import { useEffect, useRef, useState } from "react";
import { clampHousePoint, createDefaultHouseLayout, type HouseLayout, type HousePoint } from "./houseLayout";
import { HOUSE_LAYOUT_VERSION, houseLayoutStorage, houseLayoutStorageKey, parseHousePosition, persistHousePosition, type HouseLayoutStorage } from "./houseLayoutStorage";
export type HouseLayoutState = {
  /** Current user's normalized layout, never a previous user's loading result. */
  layout: HouseLayout;
  loading: boolean;
  /** Synchronous clamped update; persists only an authenticated accessible pet. */
  movePet(petId: string, point: HousePoint): void;
};
export function useHouseLayout(userId: string | null, petIds: readonly string[], version = HOUSE_LAYOUT_VERSION, storage: HouseLayoutStorage = houseLayoutStorage): HouseLayoutState {
  const ids = [...new Set(petIds)].sort(), key = JSON.stringify([userId, ids, version]);
  const scope = useRef({ key, epoch: 0, revisions: new Map<string, number>() });
  if (scope.current.key !== key) scope.current = { key, epoch: scope.current.epoch + 1, revisions: new Map() };
  const current = scope.current;
  const [state, setState] = useState<{ key: string; layout: HouseLayout; loading: boolean }>(() => ({ key, layout: createDefaultHouseLayout(ids), loading: Boolean(userId) }));
  const layout = state.key === key ? state.layout : createDefaultHouseLayout(ids);
  useEffect(() => {
    let mounted = true;
    setState({ key, layout: createDefaultHouseLayout(ids), loading: Boolean(userId) });
    if (!userId) return () => { mounted = false; };
    void Promise.all(ids.map(async (petId) => {
      const revision = current.revisions.get(petId) ?? 0;
      let raw: string | null = null; try { raw = await storage.getItem(houseLayoutStorageKey(userId, petId, version)); } catch { /* Default recovery. */ }
      if (!mounted || scope.current !== current || (current.revisions.get(petId) ?? 0) !== revision) return;
      const fallback = createDefaultHouseLayout(ids)[petId]!;
      setState((previous) => previous.key === key ? { ...previous, layout: { ...previous.layout, [petId]: parseHousePosition(raw, userId, petId, version, fallback) } } : previous);
    })).then(() => { if (mounted && scope.current === current) setState((previous) => ({ ...previous, loading: false })); });
    return () => { mounted = false; };
  }, [key, storage]);
  return { layout, loading: state.key !== key ? Boolean(userId) : state.loading, movePet: (petId, point) => {
    if (scope.current !== current || !ids.includes(petId)) return;
    const position = clampHousePoint(point);
    current.revisions.set(petId, (current.revisions.get(petId) ?? 0) + 1);
    setState((previous) => ({ key, loading: previous.key === key && previous.loading, layout: { ...(previous.key === key ? previous.layout : createDefaultHouseLayout(ids)), [petId]: position } }));
    if (userId) void persistHousePosition(storage, userId, petId, version, position);
  } };
}
