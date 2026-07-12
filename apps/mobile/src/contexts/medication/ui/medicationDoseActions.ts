import type { Dispatch, SetStateAction } from "react";
import { buildDoseRecordedAt, shouldCountDoseAsMedicationRecorded, type QuickMedicationDoseInput, type UpdateMedicationDoseInput } from "../application/medicationDoseRecords";
import type { DoseRecord, DoseStatus } from "../domain/medication";
import { t } from "../../../i18n/translations";
import { updateLocalDoseRecord } from "./localMedicationState";
import type { TodayMedicationAgendaRow } from "./todayMedicationAgenda";
import { confirmDestructiveAction } from "../../../design-system/confirmAction";

export type MedicationSaveFeedbackKind = "medication" | "medicationStatus";

type UpdateMedicationDoseMutation = { mutateAsync: (input: UpdateMedicationDoseInput) => Promise<unknown> };
type UpdateMedicationDoseStatusMutation = { mutateAsync: (input: { id: string; status: DoseStatus }) => Promise<unknown> };
type DeleteMedicationDoseMutation = { mutateAsync: (id: string) => Promise<unknown> };
type AddMedicationDoseAction = (input: QuickMedicationDoseInput) => Promise<void>;

type MedicationDoseActionArgs = {
  activePetId: string;
  databaseMode: boolean;
  doses: DoseRecord[];
  setDoses: Dispatch<SetStateAction<DoseRecord[]>>;
  onLocalDosesChanged: (nextDoses: DoseRecord[]) => void;
  setNotice: (notice: string) => void;
  onSaved: (kind: MedicationSaveFeedbackKind) => void;
};

export function hasRecordedMedication(doses: DoseRecord[], activePetId: string) {
  return doses.some((dose) => dose.petId === activePetId && shouldCountDoseAsMedicationRecorded(dose.status));
}

export async function saveMedicationDoseEdit({
  input,
  updateMedicationDose,
  ...args
}: MedicationDoseActionArgs & {
  input: UpdateMedicationDoseInput;
  updateMedicationDose: UpdateMedicationDoseMutation;
}) {
  if (args.databaseMode) {
    try {
      await updateMedicationDose.mutateAsync(input);
      args.setNotice(t("ko", "today.medicationEditedRemote"));
      args.onSaved("medication");
    } catch (error) {
      args.setNotice(error instanceof Error ? error.message : t("ko", "care.quickDoseUpdateFailed"));
      throw error;
    }
    return;
  }

  const nextDoses = args.doses.map((dose) => (dose.id === input.id ? updateLocalDoseRecord(dose, input) : dose));
  args.setDoses(nextDoses);
  args.onLocalDosesChanged(nextDoses);
  args.setNotice(t("ko", "today.medicationEdited"));
  args.onSaved("medication");
}

export function confirmAndDeleteMedicationDose({
  dose,
  deleteMedicationDose,
  ...args
}: MedicationDoseActionArgs & {
  dose: DoseRecord;
  deleteMedicationDose: DeleteMedicationDoseMutation;
}) {
  return confirmDestructiveAction({ title: t("ko", "care.quickDoseDeleteTitle"), message: t("ko", "care.quickDoseDeleteCopy"), cancelText: t("ko", "care.quickDoseDeleteCancel"), confirmText: t("ko", "care.quickDoseDeleteConfirm") }, async () => {
    if (args.databaseMode) {
      try {
        await deleteMedicationDose.mutateAsync(dose.id);
        args.setNotice(t("ko", "today.medicationDeletedRemote"));
        args.onSaved("medication");
        return true;
      } catch (error) {
        args.setNotice(error instanceof Error ? error.message : t("ko", "care.quickDoseDeleteFailed"));
        return false;
      }
    }

    const nextDoses = args.doses.filter((item) => item.id !== dose.id);
    args.setDoses(nextDoses);
    args.onLocalDosesChanged(nextDoses);
    args.setNotice(t("ko", "today.medicationDeleted"));
    args.onSaved("medication");
    return true;
  });
}

export function saveMedicationAgendaStatus({
  row,
  status,
  databaseMode,
  doses,
  updateMedicationDoseStatus,
  addMedicationDose,
  setDoses,
  onLocalDosesChanged,
  setNotice,
  onSaved,
}: MedicationDoseActionArgs & {
  row: TodayMedicationAgendaRow;
  status: Extract<DoseStatus, "completed" | "skipped" | "partial">;
  doses: DoseRecord[];
  updateMedicationDoseStatus: UpdateMedicationDoseStatusMutation;
  addMedicationDose: AddMedicationDoseAction;
}): Promise<void> | void {
  if (row.doseId) {
    if (databaseMode) {
      return updateMedicationDoseStatus.mutateAsync({ id: row.doseId, status }).then(() => { setNotice(t("ko", "today.medicationUpdatedRemote")); onSaved("medicationStatus"); }).catch((error: Error) => setNotice(error.message));
    }
    const nextDoses = doses.map((dose) => (dose.id === row.doseId ? { ...dose, status, recordedAt: buildDoseRecordedAt(status) ?? undefined } : dose));
    setDoses(nextDoses);
    onLocalDosesChanged(nextDoses);
    setNotice(t("ko", "today.medicationUpdated"));
    onSaved("medicationStatus");
    return;
  }
  return addMedicationDose({ scheduleId: row.scheduleId, doseDate: row.doseDate, scheduledTime: row.scheduledTime, medicationName: row.medicationName, conditionName: row.conditionName, dosageLabel: row.dosageLabel, status }).catch(() => undefined);
}
