import type { QuickMedicationDoseInput } from "../application/medicationDoseRecords";
import type { DoseRecord } from "../domain/medication";

export function createLocalDoseRecord(petId: string, input: QuickMedicationDoseInput, fallbackName: string): DoseRecord {
  const status = input.status ?? "pending";

  return {
    id: `dose-local-${Date.now()}`,
    petId,
    scheduleId: input.scheduleId,
    doseDate: input.doseDate,
    medicationName: input.medicationName.trim() || fallbackName,
    conditionName: input.conditionName?.trim() || undefined,
    dosageLabel: input.dosageLabel?.trim() || undefined,
    administeredAmount: input.administeredAmount?.trim() || undefined,
    scheduledAt: input.scheduledTime || formatCurrentDoseTime(),
    status,
    recordedAt: status === "pending" ? undefined : new Date().toISOString(),
    reactionNote: input.reactionNote?.trim() || undefined,
  };
}

export function updateLocalDoseRecord(current: DoseRecord, input: QuickMedicationDoseInput & { scheduledTime?: string }): DoseRecord {
  const status = input.status ?? current.status;

  return {
    ...current,
    medicationName: input.medicationName.trim() || current.medicationName,
    conditionName: input.conditionName?.trim() || undefined,
    dosageLabel: input.dosageLabel?.trim() || undefined,
    administeredAmount: input.administeredAmount?.trim() || undefined,
    scheduledAt: input.scheduledTime || current.scheduledAt,
    status,
    recordedAt: status === "pending" ? undefined : new Date().toISOString(),
    reactionNote: input.reactionNote?.trim() || undefined,
  };
}

export function shouldMarkMedicationChecklist(input: QuickMedicationDoseInput) {
  return (input.status ?? "pending") !== "pending";
}

function formatCurrentDoseTime() {
  return new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}
