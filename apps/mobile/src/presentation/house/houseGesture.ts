import { clampHousePoint, type HousePoint } from "./houseLayout";
export type HouseGestureState = { mode: "idle"; suppressTapUntil: number } | { mode: "pressing"; pointerId: number; petId?: string; start: HousePoint; position: HousePoint; moved: boolean; suppressTapUntil: number } | { mode: "dragging"; pointerId: number; petId: string; position: HousePoint; suppressTapUntil: number } | { mode: "panning"; pointerId: number; start: HousePoint; position: HousePoint; suppressTapUntil: number };
export type HouseGestureAction = { type: "down"; pointerId: number; petId?: string; point: HousePoint; now: number } | { type: "longPress"; pointerId: number; now: number } | { type: "move"; pointerId: number; point: HousePoint; now: number } | { type: "end" | "cancel"; pointerId: number; now: number };
export const initialHouseGestureState: HouseGestureState = { mode: "idle", suppressTapUntil: 0 };
/** Caller owns long-press timing; the reducer never starts timers or reads the clock. */
export function houseGestureReducer(state: HouseGestureState, action: HouseGestureAction): HouseGestureState {
  if (action.type === "down") return state.mode !== "idle" ? state : { mode: "pressing", pointerId: action.pointerId, petId: action.petId, start: action.point, position: action.point, moved: false, suppressTapUntil: state.suppressTapUntil };
  if (state.mode === "idle" || state.pointerId !== action.pointerId) return state;
  if (action.type === "end" || action.type === "cancel") return { mode: "idle", suppressTapUntil: state.mode === "dragging" || state.mode === "panning" || state.mode === "pressing" && state.moved || action.type === "cancel" ? action.now + 300 : state.suppressTapUntil };
  if (action.type === "longPress") return state.mode === "pressing" && state.petId && !state.moved ? { mode: "dragging", pointerId: state.pointerId, petId: state.petId, position: clampHousePoint(state.position), suppressTapUntil: state.suppressTapUntil } : state;
  if (action.type !== "move") return state;
  if (state.mode === "dragging") return { ...state, position: clampHousePoint(action.point) };
  if (state.mode === "panning") return { ...state, position: action.point };
  const moved = state.moved || Math.hypot(action.point.x - state.start.x, action.point.y - state.start.y) > 0.015;
  return !state.petId && moved ? { mode: "panning", pointerId: state.pointerId, start: state.start, position: action.point, suppressTapUntil: state.suppressTapUntil } : { ...state, moved, position: action.point };
}
export function canHandleHouseTap(state: HouseGestureState, now: number) { return state.mode === "idle" && now >= state.suppressTapUntil; }
export function isHouseWanderingPaused(state: HouseGestureState, petId: string, selectedPetId?: string) { return petId === selectedPetId || state.mode === "dragging" && state.petId === petId; }
