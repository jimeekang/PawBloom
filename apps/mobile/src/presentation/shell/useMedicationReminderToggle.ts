import { useEffect, useState } from "react";
import { Platform } from "react-native";
import type { CareMedicationSchedule } from "../../contexts/care/domain/carePlan";
import { cancelMedicationRemindersForAccount } from "../../contexts/medication/application/medicationReminderNotifications";
import { readMedicationRemindersEnabled, writeMedicationRemindersEnabled } from "../../contexts/medication/application/medicationReminderPreference";
import { t } from "../../i18n/translations";
import type { NoticeTone } from "../../design-system/components";
import { restoreMedicationRemindersForPets } from "./medicationReminderRestore";

type MedicationReminderToggleInput = {
  enabled: boolean;
  databaseMode: boolean;
  userId: string | null;
  activePet: { id: string; name: string };
  pets: { id: string; name: string }[] | undefined;
  activePetSchedules: CareMedicationSchedule[];
};

type MedicationReminderToggleDependencies = {
  platformOS: string;
  cancelForAccount: typeof cancelMedicationRemindersForAccount;
  restoreForPets: typeof restoreMedicationRemindersForPets;
};

export async function applyMedicationReminderToggle(input: MedicationReminderToggleInput, dependencies: Partial<MedicationReminderToggleDependencies> = {}) {
  const platformOS = dependencies.platformOS ?? Platform.OS;
  if (!input.databaseMode || !input.userId || platformOS === "web") return "skipped" as const;
  if (!input.enabled) {
    await (dependencies.cancelForAccount ?? cancelMedicationRemindersForAccount)(input.userId).catch(() => undefined);
    return "cancelled" as const;
  }
  try {
    return await (dependencies.restoreForPets ?? restoreMedicationRemindersForPets)({
      userId: input.userId,
      pets: input.pets && input.pets.length > 0 ? input.pets : [input.activePet],
      activePetId: input.activePet.id,
      activePetSchedules: input.activePetSchedules,
    });
  } catch {
    return "failed" as const;
  }
}

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
    const outcome = await applyMedicationReminderToggle({ enabled, databaseMode, userId, activePet, pets, activePetSchedules });
    if (outcome === "scheduled" || outcome === "denied") {
      setNotice(outcome === "scheduled" ? t("care.reminderScheduled") : t("care.reminderPermissionDenied"), outcome === "scheduled" ? "success" : "error");
    } else if (outcome === "failed") {
      setNotice(t("care.reminderScheduleFailed"), "error");
    }
  }

  return { medicationRemindersEnabled, toggleMedicationReminders };
}
