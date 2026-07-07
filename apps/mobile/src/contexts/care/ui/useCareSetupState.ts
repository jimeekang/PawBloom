import { useState } from "react";
import { useActiveCareSetup, useCreateCareSetup } from "../application/carePlanRecords";
import type { ActiveCareSetup, CareMedicationSchedule, CareSetupInput } from "../domain/carePlan";
import { getLocalDateKey } from "../../../shared-kernel/date";
import { t } from "../../../i18n/translations";

type Params = {
  databaseMode: boolean;
  livePetId: string | null;
  userId: string | null;
  onNotice: (notice: string) => void;
  onSaved: () => void;
};

export function useCareSetupState({ databaseMode, livePetId, userId, onNotice, onSaved }: Params) {
  const careSetupQuery = useActiveCareSetup(livePetId);
  const createCareSetup = useCreateCareSetup(livePetId, userId);
  const [localCareSetup, setLocalCareSetup] = useState<ActiveCareSetup>(() => emptyActiveCareSetup());
  const activeCareSetup = databaseMode ? careSetupQuery.data ?? emptyActiveCareSetup() : localCareSetup;

  function saveCareSetup(input: CareSetupInput) {
    if (!databaseMode) {
      const condition = input.conditionName ? { id: `local-condition-${Date.now()}`, name: input.conditionName, status: "active" as const } : undefined;
      const schedule: CareMedicationSchedule = { id: `local-schedule-${Date.now()}`, medicationId: `local-medication-${Date.now()}`, medicationName: input.medicationName || t("ko", "care.quickMedicationName"), dosageLabel: input.dosageLabel || "-", conditionId: condition?.id, conditionName: input.conditionName, localTime: `${input.localTime || "08:00"}:00`, startsOn: input.startsOn || getLocalDateKey(), endsOn: input.endsOn || undefined, recurrenceIntervalDays: input.recurrenceIntervalDays ?? 1 };
      setLocalCareSetup({ conditions: condition ? [condition, ...localCareSetup.conditions] : localCareSetup.conditions, conditionName: input.conditionName, planTitle: input.planTitle, schedules: [schedule, ...localCareSetup.schedules] });
      onNotice(t("ko", "care.setupSaved"));
      onSaved();
      return;
    }
    void createCareSetup.mutateAsync(input).then(() => {
      onNotice(t("ko", "care.setupSaved"));
      onSaved();
    }).catch((error: Error) => onNotice(error.message));
  }

  return { activeCareSetup, saveCareSetup };
}

function emptyActiveCareSetup(): ActiveCareSetup {
  return { conditions: [], schedules: [] };
}
