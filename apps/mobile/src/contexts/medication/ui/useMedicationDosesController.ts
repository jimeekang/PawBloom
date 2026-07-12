import { useMemo, useState } from "react";
import { type QuickMedicationDoseInput, type UpdateMedicationDoseInput, useCreateMedicationDose, useDeleteMedicationDose, useTodayMedicationDoses, useUpdateMedicationDose, useUpdateMedicationDoseStatus } from "../application/medicationDoseRecords";
import { getLocalDateKey } from "../../../shared-kernel/date";
import type { DoseRecord, DoseStatus } from "../domain/medication";
import type { MedicationSchedule } from "../domain/medicationSchedule";
import { t } from "../../../i18n/translations";
import { createLocalDoseRecord } from "./localMedicationState";
import { buildSampleDoses } from "./sampleDoses";
import { confirmAndDeleteMedicationDose, saveMedicationAgendaStatus as saveMedicationAgendaStatusAction, saveMedicationDoseEdit, type MedicationSaveFeedbackKind } from "./medicationDoseActions";
import { createTodayMedicationAgendaRows, type TodayMedicationAgendaRow } from "./todayMedicationAgenda";

type Params = {
  activePetId: string;
  databaseMode: boolean;
  livePetId: string | null;
  userId: string | null;
  fallbackPetId: string;
  schedules: MedicationSchedule[];
  onNotice: (notice: string) => void;
  onSaved: (kind: MedicationSaveFeedbackKind) => void;
  onLocalDoseSaved: (input: QuickMedicationDoseInput) => void;
  onLocalDosesChanged: (nextDoses: DoseRecord[]) => void;
};

export function useMedicationDosesController({ activePetId, databaseMode, livePetId, userId, fallbackPetId, schedules, onNotice, onSaved, onLocalDoseSaved, onLocalDosesChanged }: Params) {
  const dosesQuery = useTodayMedicationDoses(livePetId);
  const createMedicationDose = useCreateMedicationDose(livePetId, userId);
  const updateMedicationDose = useUpdateMedicationDose(livePetId);
  const deleteMedicationDose = useDeleteMedicationDose(livePetId);
  const updateMedicationDoseStatus = useUpdateMedicationDoseStatus(livePetId);
  const [doses, setDoses] = useState<DoseRecord[]>(() => buildSampleDoses(fallbackPetId));

  const activeDoses = useMemo(() => (databaseMode ? dosesQuery.data ?? [] : doses.filter((dose) => dose.petId === activePetId)), [activePetId, databaseMode, doses, dosesQuery.data]);
  const todayDoseDate = getLocalDateKey();
  const medicationAgenda = useMemo(() => createTodayMedicationAgendaRows({ schedules, doses: activeDoses, doseDate: todayDoseDate }), [activeDoses, schedules, todayDoseDate]);

  async function addMedicationDose(input: QuickMedicationDoseInput) {
    if (!databaseMode) {
      setDoses((current) => [createLocalDoseRecord(activePetId, input, t("ko", "care.quickMedicationName")), ...current]);
      onLocalDoseSaved(input);
      onNotice(t("ko", "care.medicationAdded"));
      onSaved("medication");
      return;
    }

    try {
      await createMedicationDose.mutateAsync(input);
      onNotice(t("ko", "care.medicationAdded"));
      onSaved("medication");
    } catch (error) {
      const message = error instanceof Error ? error.message : t("ko", "care.quickDoseNotice");
      onNotice(message);
      throw new Error(message);
    }
  }

  function saveAgendaStatus(row: TodayMedicationAgendaRow, status: Extract<DoseStatus, "completed" | "skipped" | "partial">): Promise<void> | void {
    return saveMedicationAgendaStatusAction({ row, status, activePetId, databaseMode, doses, updateMedicationDoseStatus, addMedicationDose, setDoses, onLocalDosesChanged, setNotice: onNotice, onSaved });
  }

  function updateDoseRecord(input: UpdateMedicationDoseInput) {
    return saveMedicationDoseEdit({ input, updateMedicationDose, activePetId, databaseMode, doses, setDoses, onLocalDosesChanged, setNotice: onNotice, onSaved });
  }

  function deleteDoseRecord(dose: DoseRecord) {
    return confirmAndDeleteMedicationDose({ dose, deleteMedicationDose, activePetId, databaseMode, doses, setDoses, onLocalDosesChanged, setNotice: onNotice, onSaved });
  }

  return {
    doses,
    replaceLocalDoses: setDoses,
    activeDoses,
    medicationAgenda,
    addMedicationDose,
    saveAgendaStatus,
    updateDoseRecord,
    deleteDoseRecord,
    createDoseRemote: createMedicationDose.mutateAsync,
    updateDoseStatusRemote: updateMedicationDoseStatus.mutateAsync,
  };
}
