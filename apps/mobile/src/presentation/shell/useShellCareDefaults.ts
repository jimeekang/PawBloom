import { useMemo, useState } from "react";
import { buildQuickDoseFromSchedule, useActiveCareSetup, useCreateCareSetup } from "../../contexts/care/application/carePlanRecords";
import type { ActiveCareSetup, CareMedicationSchedule, CareSetupInput } from "../../contexts/care/domain/carePlan";
import type { QuickMedicationDoseInput } from "../../contexts/medication/application/medicationDoseRecords";
import type { PetProfile } from "../../contexts/pet/domain/pet";
import { createDefaultPetRoutine, usePetRoutine, useUpsertPetRoutine } from "../../contexts/routine/application/petRoutineRecords";
import type { PetRoutineInput } from "../../contexts/routine/domain/petRoutine";
import { t } from "../../i18n/translations";
import { mockPets } from "../mockUiState";
import type { SaveFeedbackKind } from "./saveFeedback";

type Params = {
  activePet: PetProfile;
  databaseMode: boolean;
  livePetId: string | null;
  userId: string | null;
  addMedicationDose: (input: QuickMedicationDoseInput) => void | Promise<void>;
  setNotice: (notice: string) => void;
  showSaveFeedback: (kind: SaveFeedbackKind) => void;
};

export function useShellCareDefaults({ activePet, databaseMode, livePetId, userId, addMedicationDose, setNotice, showSaveFeedback }: Params) {
  const routineQuery = usePetRoutine(livePetId, activePet.species);
  const upsertRoutine = useUpsertPetRoutine(livePetId, userId, activePet.species);
  const careSetupQuery = useActiveCareSetup(livePetId);
  const createCareSetup = useCreateCareSetup(livePetId, userId);
  const [localRoutine, setLocalRoutine] = useState(() => createDefaultPetRoutine(mockPets[0].id, mockPets[0].species));
  const [localCareSetup, setLocalCareSetup] = useState<ActiveCareSetup>({ schedules: [] });
  const activeRoutine = useMemo(() => {
    if (databaseMode) return routineQuery.data ?? createDefaultPetRoutine(activePet.id, activePet.species);
    if (localRoutine.petId === activePet.id) return localRoutine;
    return createDefaultPetRoutine(activePet.id, activePet.species);
  }, [activePet.id, activePet.species, databaseMode, localRoutine, routineQuery.data]);
  const activeCareSetup = databaseMode ? careSetupQuery.data ?? { schedules: [] } : localCareSetup;

  function saveRoutine(input: PetRoutineInput) {
    if (!databaseMode) {
      setLocalRoutine({ ...input, petId: activePet.id });
      setNotice(t("ko", "routine.saved"));
      showSaveFeedback("routine");
      return;
    }
    void upsertRoutine.mutateAsync(input).then(() => {
      setNotice(t("ko", "routine.saved"));
      showSaveFeedback("routine");
    }).catch((error: Error) => setNotice(error.message));
  }

  function saveCareSetup(input: CareSetupInput) {
    if (!databaseMode) {
      const schedule: CareMedicationSchedule = { id: `local-schedule-${Date.now()}`, medicationId: `local-medication-${Date.now()}`, medicationName: input.medicationName || t("ko", "care.quickMedicationName"), dosageLabel: input.dosageLabel || "-", conditionName: input.conditionName, localTime: `${input.localTime || "08:00"}:00` };
      setLocalCareSetup({ conditionName: input.conditionName, planTitle: input.planTitle, schedules: [schedule, ...localCareSetup.schedules] });
      setNotice(t("ko", "care.setupSaved"));
      showSaveFeedback("careSetup");
      return;
    }
    void createCareSetup.mutateAsync(input).then(() => {
      setNotice(t("ko", "care.setupSaved"));
      showSaveFeedback("careSetup");
    }).catch((error: Error) => setNotice(error.message));
  }

  function useCareSchedule(schedule: CareMedicationSchedule) {
    void Promise.resolve(addMedicationDose(buildQuickDoseFromSchedule(schedule, "pending"))).catch((error: Error) => setNotice(error.message));
  }

  return { activeRoutine, activeCareSetup, saveRoutine, saveCareSetup, useCareSchedule };
}
