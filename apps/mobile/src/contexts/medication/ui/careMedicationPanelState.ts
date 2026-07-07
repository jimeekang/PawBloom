import type { QuickMedicationDoseInput } from "../application/medicationDoseRecords";
import type { DoseRecord, DoseStatus } from "../domain/medication";
import type { TranslationKey } from "../../../i18n/translations";

export type QuickMedicationFormState = Required<QuickMedicationDoseInput> & {
  scheduledTime: string;
};

export function createEmptyQuickMedicationState(): QuickMedicationFormState {
  return {
    scheduleId: "",
    doseDate: "",
    conditionName: "",
    medicationName: "",
    dosageLabel: "",
    administeredAmount: "",
    reactionNote: "",
    status: "completed",
    scheduledTime: "",
  };
}

export function createQuickMedicationEditState(dose: DoseRecord): QuickMedicationFormState {
  return {
    scheduleId: dose.scheduleId ?? "",
    doseDate: dose.doseDate ?? "",
    conditionName: dose.conditionName ?? "",
    medicationName: dose.medicationName,
    dosageLabel: dose.dosageLabel ?? "",
    administeredAmount: dose.administeredAmount ?? "",
    reactionNote: dose.reactionNote ?? "",
    status: dose.status,
    scheduledTime: normalizeDoseTime(dose.scheduledAt),
  };
}

export function normalizeDoseTime(value: string) {
  const match = value.match(/(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : value;
}

export function isValidDoseTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function shouldCloseMedicationEditAfterDelete(deleted: boolean | void) {
  return deleted !== false;
}

export function careStatusActionLabel(status: "completed" | "skipped") {
  return status === "completed" ? "먹였어요" : "못 먹였어요";
}

export function shouldShowTemporaryMedicationForm(expanded: boolean) {
  return expanded;
}

export function quickDoseSavedNoticeKey(status: DoseStatus): TranslationKey {
  if (status === "pending") return "care.quickDoseSaved.pending";
  if (status === "completed") return "care.quickDoseSaved.completed";
  if (status === "partial") return "care.quickDoseSaved.partial";
  return "care.quickDoseSaved.skipped";
}
