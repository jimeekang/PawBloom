import type { QuickMedicationDoseInput } from "../contexts/medication/application/medicationDoseRecords";
import type { DoseRecord } from "../contexts/medication/domain/medication";

export function createLocalDoseRecord(petId: string, input: QuickMedicationDoseInput, fallbackName: string): DoseRecord {
  const status = input.status ?? "pending";

  return {
    id: `dose-local-${Date.now()}`,
    petId,
    medicationName: input.medicationName.trim() || fallbackName,
    conditionName: input.conditionName?.trim() || undefined,
    dosageLabel: input.dosageLabel?.trim() || undefined,
    administeredAmount: input.administeredAmount?.trim() || undefined,
    scheduledAt: formatCurrentDoseTime(),
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
