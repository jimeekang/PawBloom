import { fetchNotificationPetIdentity, type NotificationPetIdentity } from "./notificationPetIdentity";
/** Product bound for routing enrichment; local reminders still install without identity. */
export const NOTIFICATION_IDENTITY_TIMEOUT_MS = 1500;
/** Starts one deadline alongside the lookup. dispose also settles callers and suppresses late results. */
export function startNotificationIdentityEnrichment(petId: string, timeoutMs = NOTIFICATION_IDENTITY_TIMEOUT_MS): { result: Promise<NotificationPetIdentity | null>; dispose: () => void } {
  const delay = Number.isFinite(timeoutMs) && timeoutMs >= 0 && timeoutMs <= 2_147_483_647 ? timeoutMs : NOTIFICATION_IDENTITY_TIMEOUT_MS;
  let settled = false, resolve!: (value: NotificationPetIdentity | null) => void;
  const result = new Promise<NotificationPetIdentity | null>((done) => { resolve = done; });
  const finish = (value: NotificationPetIdentity | null) => { if (settled) return; settled = true; clearTimeout(timer); resolve(value); };
  const timer = setTimeout(() => finish(null), delay);
  try { void fetchNotificationPetIdentity(petId).then(finish, () => finish(null)); } catch { finish(null); }
  return { result, dispose: () => finish(null) };
}
