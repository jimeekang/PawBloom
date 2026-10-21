import { startReminderReservation, cancelReminderReservationsForAccount } from "../../pet/application/reminderReservationScope";
import { startNotificationIdentityEnrichment } from "../../pet/application/notificationIdentityEnrichment";
import { Platform } from "react-native";
import type { PetRoutine, RoutineMealSlot } from "../domain/petRoutine";
import { isValidMealReminderTime } from "../domain/petRoutine";

export type MealReminderPlanRequest = {
  identifier: string;
  slot: RoutineMealSlot;
  title: string;
  body: string;
  trigger: { kind: "daily"; hour: number; minute: number };
};

export type MealReminderIo = {
  schedule: (request: MealReminderPlanRequest) => Promise<unknown>;
  cancel: (identifier: string) => Promise<unknown>;
};

type ScheduledNotification = { identifier: string; content?: { data?: unknown } };

const mealSlots: RoutineMealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
let activeMealReminderAccountId: string | null = null;

export function setActiveMealReminderAccount(userId: string | null): void {
  activeMealReminderAccountId = userId;
}

export function isMealReminderAccountActive(userId: string): boolean {
  return activeMealReminderAccountId === userId;
}

export function mealReminderIdentifier(userId: string, petId: string, slot: RoutineMealSlot): string {
  return `meal:${userId}:${petId}:${slot}`;
}

export function buildMealReminderPlan({ userId, petId, petName, title, slotLabels, routine }: { userId: string; petId: string; petName: string; title: string; slotLabels: Partial<Record<RoutineMealSlot, string>>; routine: PetRoutine }): MealReminderPlanRequest[] {
  if (routine.food.mealRemindersEnabled === false) return [];

  return mealSlots.flatMap((slot) => {
    const localTime = routine.food.meals[slot]?.localTime;
    if (!localTime || !isValidMealReminderTime(localTime)) return [];
    const [hour, minute] = localTime.split(":").map(Number);
    return [{
      identifier: mealReminderIdentifier(userId, petId, slot),
      slot,
      title: title || `${petName} meal time`,
      body: slotLabels[slot] ?? slot,
      trigger: { kind: "daily" as const, hour: hour ?? 0, minute: minute ?? 0 },
    }];
  });
}

export function shouldCancelMealReminderForAccount(notification: { identifier: string }, userId: string): boolean {
  return notification.identifier.startsWith(`meal:${userId}:`);
}

export function selectMealRemindersToCancel(pending: { identifier: string }[], { userId, petId, keepIdentifiers }: { userId: string; petId: string; keepIdentifiers: ReadonlySet<string> }): { identifier: string }[] {
  const prefix = `meal:${userId}:${petId}:`;
  return pending.filter((notification) => notification.identifier.startsWith(prefix) && !keepIdentifiers.has(notification.identifier));
}

export async function applyMealReminderPlan(plan: MealReminderPlanRequest[], pending: { identifier: string }[], { userId, petId }: { userId: string; petId: string }, io: MealReminderIo): Promise<void> {
  const keepIdentifiers = new Set(plan.map((request) => request.identifier));
  for (const request of plan) await io.schedule(request);
  for (const notification of selectMealRemindersToCancel(pending, { userId, petId, keepIdentifiers })) await io.cancel(notification.identifier);
}

export async function rescheduleMealReminders({ userId, petId, petName, title, slotLabels, routine, requestPermission, identityTimeoutMs }: { userId: string; petId: string; petName: string; title: string; slotLabels: Partial<Record<RoutineMealSlot, string>>; routine: PetRoutine; requestPermission: boolean; identityTimeoutMs?: number }): Promise<boolean> {
  const reservation = startReminderReservation("meal", userId, petId);
  if (Platform.OS === "web" || !isMealReminderAccountActive(userId)) { reservation.dispose(); return false; }

  const plan = buildMealReminderPlan({ userId, petId, petName, title, slotLabels, routine });
  const enrichment = plan.length ? startNotificationIdentityEnrichment(petId, identityTimeoutMs) : null;
  try {
    const Notifications = await import("expo-notifications");
    // Build the plan first: saving with reminders disabled (empty plan) must not
    // pop the OS permission dialog — it only needs to cancel stale reminders (B9).
    if (plan.length > 0) {
      const permission = requestPermission ? await Notifications.requestPermissionsAsync() : await Notifications.getPermissionsAsync();
      if (isMealReminderAccountActive(userId) && !reservation.isCurrent()) return true;
    if (!permission.granted || !isMealReminderAccountActive(userId)) return false;
    }

    const identity = await enrichment?.result;
    if (!isMealReminderAccountActive(userId)) return false;
    if (!reservation.isCurrent()) return true;
    return await reservation.run(async () => {
      const pending = await Notifications.getAllScheduledNotificationsAsync();
      if (!reservation.isCurrent() || !isMealReminderAccountActive(userId)) return false;
      await applyMealReminderPlan(plan, pending, { userId, petId }, {
        schedule: (request) => reservation.isCurrent() ? Notifications.scheduleNotificationAsync({
          identifier: request.identifier,
          content: { title: request.title, body: request.body, data: { version: 1, userId, petId, ...(identity?.petCreatedAt ? { petCreatedAt: identity.petCreatedAt } : {}), slot: request.slot } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: request.trigger.hour, minute: request.trigger.minute },
        }) : Promise.reject(new Error("Meal reminder superseded.")),
        cancel: (identifier) => reservation.isCurrent() ? Notifications.cancelScheduledNotificationAsync(identifier) : Promise.resolve(),
    });
    return true;
    }) || isMealReminderAccountActive(userId) && !reservation.isCurrent();
  } catch (error) { if (isMealReminderAccountActive(userId) && !reservation.isCurrent()) return true; throw error; } finally { enrichment?.dispose(); reservation.dispose(); }
}

// Deleting a pet has to take its reminders with it, or the phone keeps firing
// "time to feed <deleted pet>" with nothing left to record against.
export async function cancelMealRemindersForPet(userId: string, petId: string): Promise<void> {
  const reservation = startReminderReservation("meal", userId, petId);
  try { await reservation.run(async () => {
    if (Platform.OS === "web") return;
    const Notifications = await import("expo-notifications");
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    if (!reservation.isCurrent()) return;
    const owned = selectMealRemindersToCancel(pending, { userId, petId, keepIdentifiers: new Set<string>() });
    for (const notification of owned) { if (!reservation.isCurrent()) return; await Notifications.cancelScheduledNotificationAsync(notification.identifier); }
  }); } finally { reservation.dispose(); }
}

export async function cancelMealRemindersForAccount(userId: string): Promise<void> {
  await cancelReminderReservationsForAccount("meal", userId, async () => {
    if (Platform.OS === "web") return;
    const Notifications = await import("expo-notifications");
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    const owned = pending.filter((notification) => shouldCancelMealReminderForAccount(notification, userId));
    await Promise.all(owned.map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier)));
  });
}
