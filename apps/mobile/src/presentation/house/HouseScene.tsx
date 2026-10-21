import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent, type PanResponderInstance } from "react-native";
import type { PetProfile } from "../../contexts/pet/domain/pet";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize, layout as layoutTokens, radius, spacing } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import { canHandleHouseTap, houseGestureReducer, initialHouseGestureState, isHouseWanderingPaused, type HouseGestureAction, type HouseGestureState } from "./houseGesture";
import { clampHousePoint, type HouseLayout, type HousePoint } from "./houseLayout";
import { HouseBackdrop } from "./HouseBackdrop";
import { HouseCharacter } from "./HouseCharacter";
import { defaultCharacterCanvas } from "./DefaultPetCharacter";

/** Long-press timing is owned here; the reducer never reads the clock. */
export const HOUSE_LONG_PRESS_MS = 420;
const TAP_SLOP_PX = 10;
const PAN_SLOP_PX = 8;
const SLOT_WIDTH = 120;
const HEAD_SIZE = 56;
const MIN_COLUMN_SPACING = 128;
const ROOM_GROW_TOLERANCE = 0.1;
const SAFE_MIN = 0.08, SAFE_SPAN = 0.84;
const CENTER: HousePoint = { x: 0.5, y: 0.5 }, ORIGIN: HousePoint = { x: 0, y: 0 };

export type HouseSceneProps = {
  pets: readonly PetProfile[];
  userId: string | null;
  /** Normalized positions from useHouseLayout. */
  layout: HouseLayout;
  motionEnabled: boolean;
  /** Locked spots (and record-target mode) keep taps but never start a drag. */
  positionsLocked: boolean;
  /** Summary-open pet or record target; its wandering pauses. */
  selectedPetId: string | null;
  /** Shows the record-target ring on selectedPetId. */
  showSelection: boolean;
  onPetTap: (petId: string) => void;
  /** Called once when a drag ends, never per frame. */
  onMovePet: (petId: string, point: HousePoint) => void;
  /** Lets the screen return focus to the character that opened the summary. */
  registerPetNode: (petId: string, node: unknown) => void;
  /** Controls rendered at the start of the toolbar under the room. */
  toolbar?: ReactNode;
};

/** Room size grows sideways only when columns would crowd; characters never shrink. */
export function getHouseSceneGeometry(viewportWidth: number, petCount: number) {
  const width = Math.max(1, Math.round(viewportWidth));
  const height = Math.round(Math.min(380, Math.max(310, width * 0.95)));
  const columns = Math.max(1, Math.ceil(Math.sqrt(petCount)));
  const needed = Math.ceil(SLOT_WIDTH + MIN_COLUMN_SPACING * SAFE_SPAN * columns);
  // A sliver of overflow is absorbed by slightly tighter spacing instead of a pannable room.
  const contentWidth = needed <= width * (1 + ROOM_GROW_TOLERANCE) ? width : needed;
  const floorTop = Math.round(height * 0.38);
  const canvasHeight = defaultCharacterCanvas(HEAD_SIZE, true).height;
  const feetTop = floorTop + 18, feetBottom = height - 34;
  return { width, height, contentWidth, floorTop, canvasHeight, feetTop, spanX: (contentWidth - SLOT_WIDTH) / SAFE_SPAN, spanY: (feetBottom - feetTop) / SAFE_SPAN };
}
type Geometry = ReturnType<typeof getHouseSceneGeometry>;

/** Slot top-left for a normalized point; clampHousePoint keeps it inside the room. */
export function toHouseScenePosition(point: HousePoint, geometry: Geometry) {
  const safe = clampHousePoint(point);
  return { x: (safe.x - SAFE_MIN) * geometry.spanX, y: geometry.feetTop + (safe.y - SAFE_MIN) * geometry.spanY - geometry.canvasHeight };
}

export function HouseScene({ pets, userId, layout, motionEnabled, positionsLocked, selectedPetId, showSelection, onPetTap, onMovePet, registerPetNode, toolbar }: HouseSceneProps) {
  const windowSize = useWindowDimensions();
  const [viewport, setViewport] = useState(() => Math.min(430, windowSize.width) - layoutTokens.screenPadding * 2);
  const geometry = getHouseSceneGeometry(viewport, pets.length);
  const live = useRef({ geometry, layout, positionsLocked, onPetTap, onMovePet });
  live.current = { geometry, layout, positionsLocked, onPetTap, onMovePet };
  const gesture = useRef<HouseGestureState>(initialHouseGestureState);
  const [gestureView, setGestureView] = useState<HouseGestureState>(initialHouseGestureState);
  const pointerSeq = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragOrigin = useRef<HousePoint>(CENTER), panStart = useRef(0), panOffset = useRef(0);
  const panX = useRef(new Animated.Value(0)).current;
  const positions = useRef(new Map<string, Animated.ValueXY>()).current;
  const responders = useRef(new Map<string, PanResponderInstance>()).current;
  const [edges, setEdges] = useState({ atStart: true, atEnd: true });

  function dispatch(action: HouseGestureAction) {
    const prev = gesture.current, next = houseGestureReducer(prev, action);
    gesture.current = next;
    if (next.mode !== prev.mode) setGestureView(next);
    return { prev, next };
  }
  function clearTimer() { if (timer.current) clearTimeout(timer.current); timer.current = null; }
  function clampPan(value: number) { const g = live.current.geometry; return Math.min(0, Math.max(g.width - g.contentWidth, value)); }
  function syncEdges() {
    const g = live.current.geometry, atStart = panOffset.current >= -1, atEnd = panOffset.current <= g.width - g.contentWidth + 1;
    setEdges((current) => current.atStart === atStart && current.atEnd === atEnd ? current : { atStart, atEnd });
  }
  function positionFor(petId: string) {
    let value = positions.get(petId);
    if (!value) { value = new Animated.ValueXY(toHouseScenePosition(live.current.layout[petId] ?? CENTER, live.current.geometry)); positions.set(petId, value); }
    return value;
  }
  function begin(petId?: string) {
    clearTimer();
    const now = Date.now();
    if (gesture.current.mode !== "idle") dispatch({ type: "cancel", pointerId: gesture.current.pointerId, now });
    const pointerId = ++pointerSeq.current;
    dragOrigin.current = petId ? live.current.layout[petId] ?? CENTER : ORIGIN;
    panStart.current = panOffset.current;
    dispatch({ type: "down", pointerId, petId, point: dragOrigin.current, now });
    if (petId && !live.current.positionsLocked) timer.current = setTimeout(() => { timer.current = null; dispatch({ type: "longPress", pointerId, now: Date.now() }); }, HOUSE_LONG_PRESS_MS);
  }
  function panTo(dx: number) { const value = clampPan(panStart.current + dx); panOffset.current = value; panX.setValue(value); }
  function track(dx: number, dy: number) {
    const state = gesture.current, g = live.current.geometry, now = Date.now();
    if (state.mode === "idle") return;
    if (state.mode === "dragging") {
      const { next } = dispatch({ type: "move", pointerId: state.pointerId, point: { x: dragOrigin.current.x + dx / g.spanX, y: dragOrigin.current.y + dy / g.spanY }, now });
      if (next.mode === "dragging") positionFor(next.petId).setValue(toHouseScenePosition(next.position, g));
      return;
    }
    if (state.mode === "pressing" && state.petId) {
      if (Math.hypot(dx, dy) < TAP_SLOP_PX) return; // finger jitter stays a tap
      clearTimer();
      dispatch({ type: "move", pointerId: state.pointerId, point: { x: state.start.x + dx / g.spanX, y: state.start.y + dy / g.spanY }, now });
      if (g.contentWidth <= g.width || Math.abs(dx) <= Math.abs(dy)) return;
      // A sideways swipe that starts on a pet explores the room; it never moves the pet.
      dispatch({ type: "cancel", pointerId: state.pointerId, now });
      const pointerId = ++pointerSeq.current;
      dispatch({ type: "down", pointerId, point: ORIGIN, now });
    }
    const current = gesture.current;
    if (current.mode === "idle" || current.mode === "dragging") return;
    const { next } = dispatch({ type: "move", pointerId: current.pointerId, point: { x: dx / g.width, y: dy / g.height }, now });
    if (next.mode === "panning") panTo(dx);
  }
  function finish(kind: "end" | "cancel") {
    clearTimer();
    const state = gesture.current;
    if (state.mode === "idle") return;
    const now = Date.now();
    const { prev, next } = dispatch({ type: kind, pointerId: state.pointerId, now });
    if (prev.mode === "dragging") {
      if (kind === "end") live.current.onMovePet(prev.petId, prev.position);
      else positionFor(prev.petId).setValue(toHouseScenePosition(live.current.layout[prev.petId] ?? CENTER, live.current.geometry));
    } else if (prev.mode === "panning") syncEdges();
    else if (kind === "end" && prev.mode === "pressing" && prev.petId && !prev.moved && canHandleHouseTap(next, now)) live.current.onPetTap(prev.petId);
  }
  const handlers = useRef({ begin, track, finish });
  handlers.current = { begin, track, finish };
  function responderFor(petId: string) {
    let responder = responders.get(petId);
    if (!responder) {
      responder = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => gesture.current.mode !== "dragging",
        onPanResponderGrant: () => handlers.current.begin(petId),
        onPanResponderMove: (_, state) => handlers.current.track(state.dx, state.dy),
        onPanResponderRelease: () => handlers.current.finish("end"),
        onPanResponderTerminate: () => handlers.current.finish("cancel"),
      });
      responders.set(petId, responder);
    }
    return responder;
  }
  const background = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, state) => live.current.geometry.contentWidth > live.current.geometry.width && Math.abs(state.dx) > PAN_SLOP_PX && Math.abs(state.dx) > Math.abs(state.dy),
    onPanResponderGrant: () => handlers.current.begin(),
    onPanResponderMove: (_, state) => handlers.current.track(state.dx, state.dy),
    onPanResponderRelease: () => handlers.current.finish("end"),
    onPanResponderTerminate: () => handlers.current.finish("cancel"),
  })).current;

  const petKey = pets.map((pet) => pet.id).join("|");
  useEffect(() => {
    for (const pet of pets) {
      const state = gesture.current;
      if (state.mode === "dragging" && state.petId === pet.id) continue;
      positionFor(pet.id).setValue(toHouseScenePosition(layout[pet.id] ?? CENTER, geometry));
    }
    for (const id of [...positions.keys()]) if (!pets.some((pet) => pet.id === id)) { positions.delete(id); responders.delete(id); }
    const clamped = clampPan(panOffset.current);
    if (clamped !== panOffset.current) { panOffset.current = clamped; panX.setValue(clamped); }
    syncEdges();
  }, [layout, petKey, geometry.width, geometry.contentWidth, geometry.height]);
  useEffect(() => () => clearTimer(), []);

  function page(direction: -1 | 1) {
    const target = clampPan(panOffset.current - direction * geometry.width * 0.75);
    panOffset.current = target;
    Animated.timing(panX, { toValue: target, duration: 260, useNativeDriver: false }).start();
    syncEdges();
  }
  function onLayout(event: LayoutChangeEvent) {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== viewport) setViewport(next);
  }
  const ordered = [...pets].sort((a, b) => (layout[a.id]?.y ?? 0.5) - (layout[b.id]?.y ?? 0.5) || a.id.localeCompare(b.id));
  const scrollable = geometry.contentWidth > geometry.width;
  return (
    <View style={styles.wrap}>
      <View style={[styles.scene, { height: geometry.height }]} onLayout={onLayout} {...background.panHandlers}>
        <Animated.View style={{ width: geometry.contentWidth, height: geometry.height, transform: [{ translateX: panX }] }}>
          <HouseBackdrop width={geometry.contentWidth} viewport={geometry.width} height={geometry.height} floorTop={geometry.floorTop} />
          {ordered.map((pet) => {
            const point = clampHousePoint(layout[pet.id] ?? CENTER), depth = 0.86 + 0.14 * ((point.y - SAFE_MIN) / SAFE_SPAN);
            const dragging = gestureView.mode === "dragging" && gestureView.petId === pet.id;
            return (
              <Animated.View
                key={pet.id}
                ref={(node: unknown) => registerPetNode(pet.id, node)}
                {...responderFor(pet.id).panHandlers}
                accessible
                focusable={false}
                accessibilityRole="button"
                accessibilityLabel={pet.name}
                accessibilityHint={positionsLocked ? t("house.characterHintLocked") : t("house.characterHint")}
                accessibilityActions={[{ name: "activate", label: t("house.openSummary") }]}
                onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === "activate") onPetTap(pet.id); }}
                style={[styles.slot, { zIndex: dragging ? 1000 : Math.round(point.y * 100) }, { transform: [...positionFor(pet.id).getTranslateTransform(), { scale: depth }] }]}
              >
                <HouseCharacter pet={pet} userId={userId} size={HEAD_SIZE} motionEnabled={motionEnabled} wanderPaused={isHouseWanderingPaused(gestureView, pet.id, selectedPetId ?? undefined)} lifted={dragging} selected={showSelection && selectedPetId === pet.id} />
              </Animated.View>
            );
          })}
        </Animated.View>
      </View>
      <View style={styles.toolbar}>
        <View style={styles.toolbarStart}>{toolbar}</View>
        {scrollable ? <View style={styles.pager}>
          <PageButton label={t("house.pageLeft")} icon="back" disabled={edges.atStart} onPress={() => page(-1)} />
          <PageButton label={t("house.pageRight")} icon="forward" disabled={edges.atEnd} onPress={() => page(1)} />
        </View> : null}
      </View>
    </View>
  );
}

function PageButton({ label, icon, disabled, onPress }: { label: string; icon: "back" | "forward"; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.pageButton, pressed && styles.pressed, disabled && styles.disabled]}>
      <AppIcon name={icon} size={iconSize.sm} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  scene: { borderRadius: radius.xl, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceWarm },
  slot: { position: "absolute", left: 0, top: 0, width: SLOT_WIDTH, alignItems: "center" },
  toolbar: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  toolbarStart: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pager: { flexDirection: "row", gap: spacing.xs },
  pageButton: { width: layoutTokens.minTouch, height: layoutTokens.minTouch, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  pressed: { backgroundColor: colors.surfaceWarm },
  disabled: { opacity: 0.4 },
});
