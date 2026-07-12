import type { MedicationSchedule } from "../domain/medicationSchedule";
import { scheduleAppliesOnDate } from "./medicationScheduleRules";

const IOS_PENDING_NOTIFICATION_BUDGET = 60;
const ROLLING_SEARCH_DAYS = 3660;

export type MedicationReminderRequest = {
  identifier: string;
  dateKey: string;
  scheduleId: string;
  title: string;
  body: string;
  triggerDate: Date;
};

export type MedicationReminderPlanRequest =
  | (Omit<MedicationReminderRequest, "triggerDate"> & { trigger: { kind: "daily"; hour: number; minute: number } })
  | (MedicationReminderRequest & { trigger: { kind: "date"; date: Date } });

type ScheduledNotification = { identifier: string; content?: { data?: unknown } };
let activeMedicationReminderAccountId: string | null = null;

export function setActiveMedicationReminderAccount(userId: string | null) {
  activeMedicationReminderAccountId = userId;
}

export function isMedicationReminderAccountActive(userId: string) {
  return activeMedicationReminderAccountId === userId;
}

export function buildMedicationReminderRequests({ petName, reminderTitle, schedules, fromDate, daysAhead }: { petName: string; reminderTitle?: string; schedules: MedicationSchedule[]; fromDate: string; daysAhead: number }) {
  const requests: MedicationReminderRequest[] = [];
  for (let offset = 0; offset < daysAhead; offset += 1) {
    const dateKey = addDaysToDateKey(fromDate, offset);
    for (const schedule of schedules) {
      if (!scheduleAppliesOnDate(schedule, dateKey)) continue;
      requests.push(buildDatedRequest(reminderTitle ?? `${petName} medication time`, schedule, dateKey));
    }
  }
  return requests;
}

export function buildMedicationReminderPlan({ petName, reminderTitle, schedules, fromDate, maxPending, notBefore }: { petName: string; reminderTitle?: string; schedules: MedicationSchedule[]; fromDate: string; maxPending: number; notBefore?: Date }) {
  const title = reminderTitle ?? `${petName} medication time`;
  if (maxPending <= 0) return [];
  const daily = schedules
    .filter((schedule) => schedule.startsOn <= fromDate && !schedule.endsOn && schedule.recurrenceIntervalDays === 1)
    .map((schedule): MedicationReminderPlanRequest => {
      const [hour, minute] = schedule.localTime.split(":").map(Number);
      return {
        identifier: `medication:${schedule.id}:daily`,
        dateKey: "daily",
        scheduleId: schedule.id,
        title,
        body: schedule.medicationName,
        trigger: { kind: "daily", hour: hour ?? 8, minute: minute ?? 0 },
      };
    });
  const remaining = Math.max(0, maxPending - daily.length);
  const rolling = buildMedicationReminderRequests({ petName, reminderTitle: title, schedules: schedules.filter((schedule) => !daily.some((request) => request.scheduleId === schedule.id)), fromDate, daysAhead: ROLLING_SEARCH_DAYS })
    .filter((request) => !notBefore || request.triggerDate.getTime() > notBefore.getTime())
    .sort((left, right) => left.triggerDate.getTime() - right.triggerDate.getTime())
    .slice(0, remaining)
    .map((request): MedicationReminderPlanRequest => ({ ...request, trigger: { kind: "date", date: request.triggerDate } }));
  return [...daily.slice(0, maxPending), ...rolling];
}

export async function rescheduleMedicationReminders({ userId, petId, petName, reminderTitle, schedules, previousScheduleIds = [], fromDate, requestPermission = true }: { userId: string; petId: string; petName: string; reminderTitle: string; schedules: MedicationSchedule[]; previousScheduleIds?: string[]; fromDate: string; requestPermission?: boolean }) {
  if (!isMedicationReminderAccountActive(userId)) return false;
  const Notifications = await import("expo-notifications");
  const permission = requestPermission ? await Notifications.requestPermissionsAsync() : await Notifications.getPermissionsAsync();
  if (!permission.granted || !isMedicationReminderAccountActive(userId)) return false;

  const scheduleIds = new Set([...previousScheduleIds, ...schedules.map((schedule) => schedule.id)]);
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  if (!isMedicationReminderAccountActive(userId)) return false;
  const foreignAccount = pending.filter((notification) => shouldCancelMedicationReminderForOtherAccount(notification, userId));
  for (const notification of foreignAccount) {
    if (!isMedicationReminderAccountActive(userId)) return false;
    await Notifications.cancelScheduledNotificationAsync(notification.identifier);
  }
  if (!isMedicationReminderAccountActive(userId)) return false;
  const accountPending = pending.filter((notification) => !foreignAccount.includes(notification));
  const currentPet = accountPending.filter((notification) => shouldCancelMedicationReminder(notification, petId, scheduleIds, userId));
  const unrelatedCount = accountPending.length - currentPet.length;
  const maxPending = Math.max(0, IOS_PENDING_NOTIFICATION_BUDGET - unrelatedCount);
  const plan = buildMedicationReminderPlan({ petName, reminderTitle, schedules, fromDate, maxPending, notBefore: new Date() });
  const accountPlan = plan.map((request) => ({ ...request, identifier: accountScopedMedicationReminderIdentifier(userId, request.identifier) }));
  if (maxPending === 0 && schedules.some((schedule) => !schedule.endsOn || schedule.endsOn >= fromDate)) throw new Error("Medication reminder capacity is full.");
  if (!hasMedicationReminderCoverage(plan, schedules, fromDate)) {
    throw new Error("Medication reminder capacity is full.");
  }

  try {
    await installMedicationReminderPlan(accountPlan, currentPet, async (request) => {
      await installMedicationReminderForActiveAccount(userId, request, () => Notifications.scheduleNotificationAsync({
          identifier: request.identifier,
          content: { title: request.title, body: request.body, data: { userId, petId, scheduleId: request.scheduleId, dateKey: request.dateKey } },
          trigger: request.trigger.kind === "daily"
            ? { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: request.trigger.hour, minute: request.trigger.minute }
            : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: request.trigger.date },
        }),
        (identifier) => Notifications.cancelScheduledNotificationAsync(identifier));
    }, (identifier) => Notifications.cancelScheduledNotificationAsync(identifier));
  } catch (error) {
    if (!isMedicationReminderAccountActive(userId)) {
      await cancelMedicationRemindersForAccount(userId).catch(() => undefined);
      return false;
    }
    throw error;
  }
  if (!isMedicationReminderAccountActive(userId)) {
    await cancelMedicationRemindersForAccount(userId).catch(() => undefined);
    return false;
  }
  return true;
}

export async function installMedicationReminderForActiveAccount(userId: string, request: MedicationReminderPlanRequest, install: () => Promise<unknown>, cancel: (identifier: string) => Promise<unknown>) {
  if (!isMedicationReminderAccountActive(userId)) throw new Error("Medication reminder account changed.");
  await install();
  if (!isMedicationReminderAccountActive(userId)) {
    await cancel(request.identifier);
    throw new Error("Medication reminder account changed.");
  }
}

export function hasMedicationReminderCoverage(plan: MedicationReminderPlanRequest[], schedules: MedicationSchedule[], fromDate: string) {
  const plannedScheduleIds = new Set(plan.map((request) => request.scheduleId));
  const planningHorizon = addDaysToDateKey(fromDate, ROLLING_SEARCH_DAYS - 1);
  return !schedules.some((schedule) => schedule.startsOn <= planningHorizon
    && (!schedule.endsOn || schedule.endsOn >= fromDate)
    && !plannedScheduleIds.has(schedule.id));
}

export async function installMedicationReminderPlan(plan: MedicationReminderPlanRequest[], currentPet: ScheduledNotification[], install: (request: MedicationReminderPlanRequest) => Promise<unknown>, cancel: (identifier: string) => Promise<unknown>) {
  const desiredIds = new Set(plan.map((request) => request.identifier));
  const canceledIds = new Set<string>();
  const pendingIds = new Set(currentPet.map((notification) => notification.identifier));
  const obsolete = currentPet.filter((notification) => !desiredIds.has(notification.identifier));
  for (const request of plan) {
    const addsPendingSlot = !pendingIds.has(request.identifier);
    await install(request);
    pendingIds.add(request.identifier);
    if (addsPendingSlot) {
      const replacement = obsolete.find((notification) => !canceledIds.has(notification.identifier)
        && medicationReminderScheduleId(notification) === request.scheduleId)
        ?? obsolete.find((notification) => !canceledIds.has(notification.identifier));
      if (replacement) {
        await cancel(replacement.identifier);
        canceledIds.add(replacement.identifier);
        pendingIds.delete(replacement.identifier);
      }
    }
  }
  for (const notification of currentPet) {
    if (!canceledIds.has(notification.identifier) && !desiredIds.has(notification.identifier)) await cancel(notification.identifier);
  }
}

export function shouldCancelMedicationReminder(notification: ScheduledNotification, petId: string, scheduleIds: ReadonlySet<string>, userId: string | null = null) {
  if (!notification.identifier.startsWith("medication:")) return false;
  const data = notification.content?.data;
  if (userId && data && typeof data === "object" && "userId" in data && typeof data.userId === "string" && data.userId !== userId) return false;
  if (data && typeof data === "object" && "petId" in data && typeof data.petId === "string") return data.petId === petId;
  const scheduleId = medicationReminderScheduleId(notification);
  return Boolean(scheduleId && scheduleIds.has(scheduleId));
}

export async function cancelMedicationRemindersForAccount(userId: string) {
  const Notifications = await import("expo-notifications");
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  const owned = pending.filter((notification) => shouldCancelMedicationReminderForAccount(notification, userId));
  await Promise.all(owned.map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier)));
}

export function shouldCancelMedicationReminderForAccount(notification: ScheduledNotification, userId: string) {
  if (!notification.identifier.startsWith("medication:")) return false;
  const data = notification.content?.data;
  if (data && typeof data === "object" && "userId" in data && typeof data.userId === "string") return data.userId === userId;
  return true;
}

export function shouldCancelMedicationReminderForOtherAccount(notification: ScheduledNotification, userId: string) {
  if (!notification.identifier.startsWith("medication:")) return false;
  const data = notification.content?.data;
  if (data && typeof data === "object" && "userId" in data && typeof data.userId === "string") return data.userId !== userId;
  return true;
}

export function accountScopedMedicationReminderIdentifier(userId: string, identifier: string) {
  const suffix = identifier.startsWith("medication:") ? identifier.slice("medication:".length) : identifier;
  return `medication:${userId}:${suffix}`;
}

function medicationReminderScheduleId(notification: ScheduledNotification) {
  const data = notification.content?.data;
  if (data && typeof data === "object" && "scheduleId" in data && typeof data.scheduleId === "string") return data.scheduleId;
  return notification.identifier.split(":")[1];
}

function buildDatedRequest(reminderTitle: string, schedule: MedicationSchedule, dateKey: string): MedicationReminderRequest {
  return {
    identifier: `medication:${schedule.id}:${dateKey}`,
    dateKey,
    scheduleId: schedule.id,
    title: reminderTitle,
    body: schedule.medicationName,
    triggerDate: buildLocalTriggerDate(dateKey, schedule.localTime),
  };
}

function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildLocalTriggerDate(dateKey: string, localTime: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = localTime.split(":").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, hour ?? 8, minute ?? 0, 0, 0);
}
