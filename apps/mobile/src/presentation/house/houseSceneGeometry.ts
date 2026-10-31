import { houseColumnCount, clampHousePoint, type HousePoint } from "./houseLayout";
import { characterReactionDuration, characterWanderReach } from "../../contexts/avatar/ui/characterMotionController";
import type { CharacterSpecies } from "../../contexts/avatar/domain/appearance";
import { houseNameTagHeight, houseNameTagOffset } from "./HouseCharacter";
import { defaultCharacterCanvas, characterGroundOffset } from "./DefaultPetCharacter";

export const SLOT_WIDTH = 120;
/** Clear room between the room border and any character pixel or name tag. */
const EDGE_GAP = 8;
/** styles.scene border; content is laid out inside it on both edges. */
export const ROOM_BORDER = 1;
/** Phones narrower than this use the 1.5x (72px) character; wider ones use 2x (96px). */
export const FULL_SIZE_MIN_WIDTH = 390;
const MIN_COLUMN_SPACING = 144;
const ROOM_GROW_TOLERANCE = 0.1;
const SAFE_MIN = 0.08, SAFE_SPAN = 0.84;
/** Room size grows sideways only when columns would crowd; characters never shrink. */
export function getHouseSceneGeometry(viewportWidth: number, petCount: number, characterSize = 96) {
  const width = Math.max(1, Math.round(viewportWidth));
  const height = Math.round(Math.min(380, Math.max(310, width * 0.95)));
  const columns = houseColumnCount(petCount);
  // Mirroring flips a pose inside its square canvas, so half the canvas bounds the sprite (tail included) in
  // either direction. The name tag (at most one slot wide) wanders with the pet, so it shares the same reserve.
  const inset = Math.ceil(Math.max(characterSize / 2, SLOT_WIDTH / 2) + characterWanderReach + EDGE_GAP + ROOM_BORDER);
  const needed = inset * 2 + MIN_COLUMN_SPACING * (columns - 1);
  // A sliver of overflow is absorbed by slightly tighter spacing instead of a pannable room.
  const contentWidth = needed <= width * (1 + ROOM_GROW_TOLERANCE) ? width : needed;
  const floorTop = Math.round(height * 0.38);
  const canvasHeight = defaultCharacterCanvas(characterSize, true).height;
  const groundOffset = characterGroundOffset(characterSize);
  // The name tag hangs below the feet: keep its bottom edge inside the room as well.
  const feetTop = floorTop + 18, feetBottom = height - ROOM_BORDER * 2 - (houseNameTagOffset + houseNameTagHeight + EDGE_GAP);
  return { width, height, contentWidth, floorTop, canvasHeight, characterSize, groundOffset, feetTop, inset, spanX: Math.max(0, contentWidth - inset * 2) / SAFE_SPAN, spanY: (feetBottom - feetTop) / SAFE_SPAN };
}
export type HouseSceneGeometry = ReturnType<typeof getHouseSceneGeometry>;
/** Slot top-left for a normalized point; clampHousePoint keeps it inside the room. */
export function toHouseScenePosition(point: HousePoint, geometry: HouseSceneGeometry) {
  const safe = clampHousePoint(point);
  return { x: geometry.inset - SLOT_WIDTH / 2 + (safe.x - SAFE_MIN) * geometry.spanX, y: geometry.feetTop + (safe.y - SAFE_MIN) * geometry.spanY - geometry.groundOffset };
}
/** Reduced motion has no wave to wait for; the sheet opens right after the tap. */
const SUMMARY_DELAY_REDUCED_MS = 120;
/** List taps: the scene may be scrolled away, so keep the short acknowledgement delay. */
const SUMMARY_DELAY_LIST_MS = 320;
/** Scene-tap timer cap: timer plus the sheet's first render (~30ms on web) must land within 650ms of the tap.
 * The wave's fourth frame starts at 500ms, so every wave pose shows before the sheet slides up from below. */
const SUMMARY_DELAY_SCENE_MAX_MS = 600;
/** A scene tap waits for the pet's wave clip (4 frames at 6fps) before the summary sheet's backdrop covers it. */
export function summaryOpenDelay(species: CharacterSpecies, from: "scene" | "list", reduced: boolean) {
  if (reduced) return SUMMARY_DELAY_REDUCED_MS;
  if (from === "list") return SUMMARY_DELAY_LIST_MS;
  return Math.min(SUMMARY_DELAY_SCENE_MAX_MS, Math.max(SUMMARY_DELAY_LIST_MS, characterReactionDuration(species, "wave")));
}
