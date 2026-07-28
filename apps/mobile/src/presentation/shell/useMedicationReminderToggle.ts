import { useEffect, useState } from "react";
import { Platform } from "react-native";
import type { CareMedicationSchedule } from "../../contexts/care/domain/carePlan";
import { cancelMedicationRemindersForAccount } from "../../contexts/medication/application/medicationReminderNotifications";
import { readMedicationRemindersEnabled, writeMedicationRemindersEnabled } from "../../contexts/medication/application/medicationReminderPreference";
import { t } from "../../i18n/translations";
import type { NoticeTone } from "../../design-system/components";
import { restoreMedicationRemindersForPets } from "./medicationReminderRestore";

// Device-local medication reminder preference plus the account-wide cancel /
// every-pet restore that acting on it requires (0007 B2).
export function useMedicationReminderToggle({ databaseMode, userId, activePet, pets, activePetSchedules, setNotice }: {
  databaseMode: boolean;
  userId: string | null;
  activePet: { id: string; name: string };
  pets: { id: string; name: string }[] | undefined;
  activePetSchedules: CareMedicationSchedule[];
  setNotice: (text: string, tone?: NoticeTone) => void;
}) {
  const [medicationRemindersEnabled, setMedicationRemindersEnabled] = useState(true);
  useEffect(() => {
    void readMedicationRemindersEnabled().then(setMedicationRemindersEnabled);
  }, []);

  async function toggleMedicationReminders(enabled: boolean) {
    setMedicationRemindersEnabled(enabled);
    await writeMedicationRemindersEnabled(enabled);
    if (!databaseMode || !userId || Platform.OS === "web") return;
    if (!enabled) {
      await cancelMedicationRemindersForAccount(userId).catch(() => undefined);
      return;
    }
    try {
      const outcome = await restoreMedicationRemindersForPets({ userId, pets: pets && pets.length > 0 ? pets : [activePet], activePetId: activePet.id, activePetSchedules });
      setNotice(outcome === "scheduled" ? t("care.reminderScheduled") : t("care.reminderPermissionDenied"), outcome === "scheduled" ? "success" : "error");
    } catch {
      setNotice(t("care.reminderScheduleFailed"), "error");
    }
  }

  return { medicationRemindersEnabled, toggleMedicationReminders };
}
