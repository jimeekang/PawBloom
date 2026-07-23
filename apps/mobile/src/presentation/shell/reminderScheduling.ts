import { useEffect } from "react";
import { AppState } from "react-native";
import type { CareMedicationSchedule } from "../../contexts/care/domain/carePlan";
import { rescheduleMedicationReminders } from "../../contexts/medication/application/medicationReminderNotifications";
import { rescheduleMealReminders } from "../../contexts/routine/application/mealReminderNotifications";
import type { PetRoutine, RoutineMealSlot } from "../../contexts/routine/domain/petRoutine";
import { t } from "../../i18n/translations";
import type { Language } from "../../shared-kernel/types";
import { getLocalDateKey } from "../../shared-kernel/date";

type ReminderPetContext = {
  userId: string | null;
  petId: string;
  petName: string;
};

export function refreshMedicationReminders({ userId, petId, petName, schedules, requestPermission, previousScheduleIds = schedules.map((schedule) => schedule.id) }: ReminderPetContext & {
  schedules: CareMedicationSchedule[];
  requestPermission: boolean;
  previousScheduleIds?: string[];
}) {
  if (!userId) return Promise.resolve(false);
  return rescheduleMedicationReminders({
    userId,
    petId,
    petName,
    reminderTitle: t("ko", "care.reminderTitle").replace("{petName}", petName),
    schedules,
    previousScheduleIds,
    fromDate: getLocalDateKey(),
    requestPermission,
  });
}

export function refreshMealReminders({ userId, petId, petName, routine, requestPermission }: ReminderPetContext & {
  routine: PetRoutine;
  requestPermission: boolean;
}) {
  if (!userId) return Promise.resolve(false);
  return rescheduleMealReminders({
    userId,
    petId,
    petName,
    title: t("ko", "routine.mealReminderTitle").replace("{petName}", petName),
    slotLabels: {
      breakfast: t("ko", "routine.breakfast"),
      lunch: t("ko", "routine.lunch"),
      dinner: t("ko", "routine.dinner"),
      snack: t("ko", "diary.meal.snack"),
    },
    routine,
    requestPermission,
  });
}

export function useReminderAutoRefresh({ databaseMode, userId, petId, petName, language, schedules, activeRoutine }: ReminderPetContext & {
  databaseMode: boolean;
  language: Language;
  schedules: CareMedicationSchedule[];
  activeRoutine: PetRoutine;
}) {
  const reminderScheduleKey = schedules.map((schedule) => `${schedule.id}:${schedule.localTime}:${schedule.startsOn}:${schedule.endsOn ?? ""}:${schedule.recurrenceIntervalDays}`).join("|");
  const mealReminderScheduleKey = [activeRoutine.food.mealRemindersEnabled, ...(["breakfast", "lunch", "dinner", "snack"] as RoutineMealSlot[]).map((slot) => `${slot}:${activeRoutine.food.meals[slot]?.localTime ?? ""}`)].join("|");

  useEffect(() => {
    if (!databaseMode || schedules.length === 0) return;
    const refresh = () => void refreshMedicationReminders({ userId, petId, petName, schedules, requestPermission: false }).catch(() => undefined);
    refresh();
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") refresh(); });
    return () => subscription.remove();
  }, [petId, petName, databaseMode, language, reminderScheduleKey, userId]);

  useEffect(() => {
    if (!databaseMode || !userId) return;
    const refresh = () => void refreshMealReminders({ userId, petId, petName, routine: activeRoutine, requestPermission: false }).catch(() => undefined);
    refresh();
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") refresh(); });
    return () => subscription.remove();
  }, [petId, petName, databaseMode, language, mealReminderScheduleKey, userId]);
}
