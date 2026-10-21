export type HousePoint = Readonly<{ x: number; y: number }>;
export type HouseBounds = Readonly<{ minX: number; maxX: number; minY: number; maxY: number }>;
export type HouseLayout = Readonly<Record<string, HousePoint>>;
const safeBounds: HouseBounds = { minX: 0.08, maxX: 0.92, minY: 0.08, maxY: 0.92 };
function validBounds(bounds: HouseBounds) { return Object.values(bounds).every(Number.isFinite) && bounds.minX >= 0 && bounds.minY >= 0 && bounds.maxX <= 1 && bounds.maxY <= 1 && bounds.minX <= bounds.maxX && bounds.minY <= bounds.maxY; }
/** All output stays in normalized safe bounds; invalid inputs recover to the center. */
export function clampHousePoint(point: HousePoint, bounds = safeBounds): HousePoint {
  const b = validBounds(bounds) ? bounds : safeBounds;
  return { x: Math.max(b.minX, Math.min(b.maxX, Number.isFinite(point.x) ? point.x : (b.minX + b.maxX) / 2)), y: Math.max(b.minY, Math.min(b.maxY, Number.isFinite(point.y) ? point.y : (b.minY + b.maxY) / 2)) };
}
/** Stable ID order, unlimited pet count, centered final row. No random layout or server state. */
export function createDefaultHouseLayout(petIds: readonly string[], bounds = safeBounds): HouseLayout {
  const ids = [...new Set(petIds)].sort(), columns = Math.ceil(Math.sqrt(ids.length)), rows = Math.ceil(ids.length / columns);
  return Object.fromEntries(ids.map((id, i) => {
    const row = Math.floor(i / columns), rowCount = Math.min(columns, ids.length - row * columns);
    return [id, clampHousePoint({ x: (i % columns + 0.5 + (columns - rowCount) / 2) / columns, y: (row + 0.5) / rows }, bounds)];
  }));
}
