import { canHandleHouseTap, houseGestureReducer as reduce, initialHouseGestureState, isHouseWanderingPaused } from "./houseGesture";
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
let state = reduce(initialHouseGestureState, { type: "down", pointerId: 1, petId: "a", point: { x: 0.5, y: 0.5 }, now: 0 });
assert(state.mode === "pressing", "pet presses first");
assert(reduce(state, { type: "longPress", pointerId: 2, now: 500 }) === state, "foreign pointer ignored");
state = reduce(state, { type: "longPress", pointerId: 1, now: 500 }); assert(state.mode === "dragging" && isHouseWanderingPaused(state, "a") && !isHouseWanderingPaused(state, "b"), "only dragged pet pauses");
state = reduce(state, { type: "move", pointerId: 1, point: { x: 99, y: -1 }, now: 600 }); assert(state.mode === "dragging" && state.position.x === 0.92, "drag clamp");
state = reduce(state, { type: "end", pointerId: 1, now: 700 }); assert(!canHandleHouseTap(state, 701) && canHandleHouseTap(state, 1000), "tap suppressed immediately after drag");
state = reduce(state, { type: "down", pointerId: 1, point: { x: 0.1, y: 0.1 }, now: 1001 }); state = reduce(state, { type: "move", pointerId: 1, point: { x: 0.5, y: 0.5 }, now: 1100 }); assert(state.mode === "panning", "background movement pans");
state = reduce(state, { type: "cancel", pointerId: 1, now: 1200 }); assert(state.mode === "idle" && !canHandleHouseTap(state, 1200), "cancel releases and suppresses tap");
state = reduce(state, { type: "down", pointerId: 3, petId: "a", point: { x: 0, y: 0 }, now: 1500 }); state = reduce(state, { type: "move", pointerId: 3, point: { x: 0.8, y: 0 }, now: 1501 }); state = reduce(state, { type: "longPress", pointerId: 3, now: 2000 }); assert(state.mode === "pressing", "moving pet before long press never becomes drag");
