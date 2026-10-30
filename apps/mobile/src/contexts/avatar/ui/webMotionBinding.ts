type Driver = { __getValue(): unknown; addListener(callback: () => void): string; removeListener(id: string): void };
type MotionStyle = { opacity?: unknown; transform?: readonly Record<string, unknown>[] };
type Target = { style: { opacity: string; transform: string } };
function isDriver(value: unknown): value is Driver { return Boolean(value && typeof value === "object" && "__getValue" in value && "addListener" in value); }
export function resolveMotionStyle(value: unknown): any {
  if (isDriver(value)) return value.__getValue();
  if (Array.isArray(value)) return value.map(resolveMotionStyle);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveMotionStyle(item)]));
  return value;
}
/** RN Web 0.21's Animated.View schedules React updates. Bind only transform/opacity instead.
 * __getValue is the installed Animated node's snapshot API; keep this adapter covered on upgrades. */
export function bindWebMotion(target: Target, style: MotionStyle, sources?: readonly Driver[]): () => void {
  const drivers = new Set<Driver>();
  function visit(value: unknown) {
    if (isDriver(value)) drivers.add(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  }
  function update() {
    const current = resolveMotionStyle(style);
    if (current.opacity !== undefined) target.style.opacity = String(current.opacity);
    if (current.transform) target.style.transform = current.transform.map((entry: Record<string, unknown>) => Object.entries(entry).map(([key, value]) => `${key}(${value}${key.startsWith("translate") && typeof value === "number" ? "px" : ""})`).join(" ")).join(" ");
  }
  // Derived nodes do not attach to parents just by adding a listener in RN Web.
  // Observe the explicit source values and read the derived snapshots on updates.
  if (sources) sources.forEach((driver) => drivers.add(driver)); else visit(style);
  update();
  const subscriptions = [...drivers].map((driver) => [driver, driver.addListener(update)] as const);
  return () => subscriptions.forEach(([driver, id]) => driver.removeListener(id));
}
