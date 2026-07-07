import type { MedicationSchedule } from "../domain/medicationSchedule";
import { scheduleAppliesOnDate } from "./medicationScheduleRules";

export type MedicationReminderRequest = {
  identifier: string;
  dateKey: string;
  scheduleId: string;
  title: string;
  body: string;
  triggerDate: Date;
};

export function buildMedicationReminderRequests({ petName, schedules, fromDate, daysAhead }: { petName: string; schedules: MedicationSchedule[]; fromDate: string; daysAhead: number }) {
  const requests: MedicationReminderRequest[] = [];
  for (let offset = 0; offset < daysAhead; offset += 1) {
    const dateKey = addDaysToDateKey(fromDate, offset);
    for (const schedule of schedules) {
      if (!scheduleAppliesOnDate(schedule, dateKey)) continue;
      requests.push({
        identifier: `medication:${schedule.id}:${dateKey}`,
        dateKey,
        scheduleId: schedule.id,
        title: `${petName} 약 먹일 시간이에요`,
        body: schedule.medicationName,
        triggerDate: buildLocalTriggerDate(dateKey, schedule.localTime),
      });
    }
  }
  return requests;
}

export async function rescheduleMedicationReminders({ petName, schedules, fromDate }: { petName: string; schedules: MedicationSchedule[]; fromDate: string }) {
  const Notifications = await import("expo-notifications");
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;
  for (const notification of await Notifications.getAllScheduledNotificationsAsync()) {
    if (notification.identifier.startsWith("medication:")) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
  for (const request of buildMedicationReminderRequests({ petName, schedules, fromDate, daysAhead: 30 })) {
    await Notifications.scheduleNotificationAsync({
      identifier: request.identifier,
      content: { title: request.title, body: request.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: request.triggerDate },
    });
  }
  return true;
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
