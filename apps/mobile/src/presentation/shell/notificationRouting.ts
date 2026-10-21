import type { NotificationIdentityValidation } from "../../contexts/pet/application/notificationPetIdentity";
import type { CareDestination } from "../navigation/appRoute";
import { getLocalDateKey } from "../../shared-kernel/date";
export type NotificationRouteTarget = { userId: string; petId: string; petCreatedAt: string; scheduleId?: string; scheduleCreatedAt?: string; dateKey: string; destination: CareDestination };
/** A house result is account-bound and intentionally carries no pet or mutation target. */
export type NotificationOpenTarget = NotificationRouteTarget | { kind: "house"; userId: string };
type ParsedNotificationTarget = Omit<NotificationRouteTarget, "petCreatedAt"> & { petCreatedAt?: string };
export type NotificationRoutingScope = { initialized: boolean; userId: string | null; petsReady: boolean; petIds: readonly string[] };
export type NotificationResponse = { actionIdentifier: string; notification: { date: number; request: { identifier: string; content: { data?: unknown } } } };
export const DEFAULT_NOTIFICATION_ACTION = "expo.modules.notifications.actions.DEFAULT";
function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number), date = new Date(y!, m! - 1, d);
  return getLocalDateKey(date) === value;
}
/** Valid v1 reminders without incarnation fields can only open the same account's house. */
export function parseNotificationRoute(response: NotificationResponse): ParsedNotificationTarget | null {
  if (response?.actionIdentifier !== DEFAULT_NOTIFICATION_ACTION) return null;
  const raw = response.notification?.request?.content?.data;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  if (data.version !== 1 || ![data.userId, data.petId].every((value) => typeof value === "string" && value.length > 0)) return null;
  if (["petCreatedAt", "scheduleCreatedAt"].some((key) => data[key] !== undefined && (typeof data[key] !== "string" || !data[key]))) return null;
  const delivery = response.notification.date;
  const dateKey = data.dateKey === "daily" || data.slot ? Number.isFinite(delivery) && delivery > 0 ? getLocalDateKey(new Date(delivery)) : null : data.dateKey;
  if (!validDate(dateKey)) return null;
  if (data.scheduleId !== undefined && (typeof data.scheduleId !== "string" || !data.scheduleId)) return null;
  if (!data.scheduleId && !["breakfast", "lunch", "dinner", "snack"].includes(String(data.slot))) return null;
  return { userId: data.userId as string, petId: data.petId as string, petCreatedAt: data.petCreatedAt as string, scheduleId: data.scheduleId as string | undefined, scheduleCreatedAt: data.scheduleCreatedAt as string | undefined, dateKey, destination: data.scheduleId ? { view: "medication", scheduleId: data.scheduleId as string, dateKey } : { view: "diary", dateKey } };
}
/** One collector owns cold/live responses. It only opens; it has no mutation dependency. */
export function createNotificationRouter(validate: (target: NotificationRouteTarget) => Promise<NotificationIdentityValidation>, open: (target: NotificationOpenTarget) => void) {
  let scope: NotificationRoutingScope = { initialized: false, userId: null, petsReady: false, petIds: [] }, generation = 0, disposed = false;
  const pending = new Map<string, ParsedNotificationTarget>(), seen = new Set<string>(), validating = new Set<string>();
  const allowed = (target: ParsedNotificationTarget) => scope.userId === target.userId && scope.petsReady && scope.petIds.includes(target.petId);
  async function flush() {
    if (disposed || !scope.initialized) return;
    for (const [key, target] of pending) {
      if (!scope.userId || scope.userId !== target.userId) { pending.delete(key); continue; }
      if (!scope.petsReady || validating.has(key)) continue;
      if (!target.petCreatedAt || target.scheduleId && !target.scheduleCreatedAt || !allowed(target)) { pending.delete(key); open({ kind: "house", userId: target.userId }); continue; }
      validating.add(key); const requestGeneration = generation;
      let result: NotificationIdentityValidation = "unavailable"; try { result = await validate(target as NotificationRouteTarget); } catch { /* Temporary errors open only the account house. */ }
      validating.delete(key);
      if (disposed) return;
      if (requestGeneration !== generation) { pending.delete(key); continue; }
      pending.delete(key);
      if (result === "valid" && allowed(target)) open(target as NotificationRouteTarget);
      else if (scope.userId === target.userId) open({ kind: "house", userId: target.userId });
    }
  }
  return {
    updateScope(next: NotificationRoutingScope) {
      if (scope.userId !== next.userId || scope.petsReady !== next.petsReady || JSON.stringify(scope.petIds) !== JSON.stringify(next.petIds)) generation++;
      scope = next; void flush();
    },
    receive(response: NotificationResponse) {
      const target = parseNotificationRoute(response); if (!target || disposed) return;
      const key = JSON.stringify([response.notification.request.identifier, response.actionIdentifier, response.notification.date]);
      if (seen.has(key)) return;
      seen.add(key); if (seen.size > 128) seen.delete(seen.values().next().value!);
      pending.set(key, target); void flush();
    },
    dispose() { disposed = true; generation++; pending.clear(); },
  };
}
