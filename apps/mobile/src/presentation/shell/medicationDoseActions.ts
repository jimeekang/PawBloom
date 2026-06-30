import type { Dispatch, SetStateAction } from "react";
import { shouldCountDoseAsMedicationRecorded, type UpdateMedicationDoseInput } from "../../contexts/medication/application/medicationDoseRecords";
import type { DoseRecord } from "../../contexts/medication/domain/medication";
import { t } from "../../i18n/translations";
import { updateLocalDoseRecord } from "../localMedicationState";
import type { ChecklistKey } from "../mockUiState";
import { confirmDestructiveAction } from "./confirmAction";
import type { SaveFeedbackKind } from "./saveFeedback";

type ChecklistState = Record<ChecklistKey, boolean>;
type UpdateMedicationDoseMutation = { mutateAsync: (input: UpdateMedicationDoseInput) => Promise<unknown> };
type DeleteMedicationDoseMutation = { mutateAsync: (id: string) => Promise<unknown> };

type MedicationDoseActionArgs = {
  activePetId: string;
  databaseMode: boolean;
  setDoses: Dispatch<SetStateAction<DoseRecord[]>>;
  setLocalChecklist: Dispatch<SetStateAction<ChecklistState>>;
  setNotice: (notice: string) => void;
  showSaveFeedback: (kind: SaveFeedbackKind) => void;
};

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
      args.showSaveFeedback("medication");
    } catch (error) {
      args.setNotice(error instanceof Error ? error.message : t("ko", "care.quickDoseUpdateFailed"));
      throw error;
    }
    return;
  }

  let nextDoses: DoseRecord[] = [];
  args.setDoses((current) => {
    nextDoses = current.map((dose) => (dose.id === input.id ? updateLocalDoseRecord(dose, input) : dose));
    return nextDoses;
  });
  args.setLocalChecklist((current) => ({ ...current, medication: hasRecordedMedication(nextDoses, args.activePetId) }));
  args.setNotice(t("ko", "today.medicationEdited"));
  args.showSaveFeedback("medication");
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
        args.showSaveFeedback("medication");
        return true;
      } catch (error) {
        args.setNotice(error instanceof Error ? error.message : t("ko", "care.quickDoseDeleteFailed"));
        return false;
      }
    }

    let nextDoses: DoseRecord[] = [];
    args.setDoses((current) => {
      nextDoses = current.filter((item) => item.id !== dose.id);
      return nextDoses;
    });
    args.setLocalChecklist((current) => ({ ...current, medication: hasRecordedMedication(nextDoses, args.activePetId) }));
    args.setNotice(t("ko", "today.medicationDeleted"));
    args.showSaveFeedback("medication");
    return true;
  });
}

function hasRecordedMedication(doses: DoseRecord[], activePetId: string) {
  return doses.some((dose) => dose.petId === activePetId && shouldCountDoseAsMedicationRecorded(dose.status));
}
