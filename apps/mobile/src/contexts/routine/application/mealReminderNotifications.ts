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

export async function rescheduleMealReminders({ userId, petId, petName, title, slotLabels, routine, requestPermission }: { userId: string; petId: string; petName: string; title: string; slotLabels: Partial<Record<RoutineMealSlot, string>>; routine: PetRoutine; requestPermission: boolean }): Promise<boolean> {
  if (Platform.OS === "web" || !isMealReminderAccountActive(userId)) return false;

  const Notifications = await import("expo-notifications");
  const permission = requestPermission ? await Notifications.requestPermissionsAsync() : await Notifications.getPermissionsAsync();
  if (!permission.granted || !isMealReminderAccountActive(userId)) return false;

  const pending = await Notifications.getAllScheduledNotificationsAsync();
  if (!isMealReminderAccountActive(userId)) return false;
  const plan = buildMealReminderPlan({ userId, petId, petName, title, slotLabels, routine });
  await applyMealReminderPlan(plan, pending, { userId, petId }, {
    schedule: (request) => Notifications.scheduleNotificationAsync({
      identifier: request.identifier,
      content: { title: request.title, body: request.body, data: { userId, petId, slot: request.slot } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: request.trigger.hour, minute: request.trigger.minute },
    }),
    cancel: (identifier) => Notifications.cancelScheduledNotificationAsync(identifier),
  });
  return true;
}

export async function cancelMealRemindersForAccount(userId: string): Promise<void> {
  if (Platform.OS === "web") return;
  const Notifications = await import("expo-notifications");
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  const owned = pending.filter((notification) => shouldCancelMealReminderForAccount(notification, userId));
  await Promise.all(owned.map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier)));
}
