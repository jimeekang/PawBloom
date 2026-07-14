import type { ComponentProps } from "react";
import type { DoseRecord } from "../domain/medication";
import { updateLocalDoseRecord } from "./localMedicationState";
import { QuickMedicationForm, type QuickMedicationSaveHandler } from "./CareMedicationPanel";
import { careStatusActionLabel, createEmptyQuickMedicationState, createQuickMedicationEditState, isValidDoseTime, quickDoseSavedNoticeKey, shouldCloseMedicationEditAfterDelete, shouldShowTemporaryMedicationForm } from "./careMedicationPanelState";

const asyncSave: QuickMedicationSaveHandler = async (input) => {
  const medicationName: string = input.medicationName;
  void medicationName;
};

const syncSave: QuickMedicationSaveHandler = (input) => {
  const medicationName: string = input.medicationName;
  void medicationName;
};

const asyncProps: ComponentProps<typeof QuickMedicationForm> = { onSave: asyncSave };
const syncProps: ComponentProps<typeof QuickMedicationForm> = { onSave: syncSave };
const editingDose: DoseRecord = {
  id: "dose-1",
  petId: "pet-1",
  conditionName: "Cough",
  medicationName: "Amoxi",
  dosageLabel: "1 tablet",
  administeredAmount: "0.5 tablet",
  scheduledAt: "21:10",
  status: "partial",
  reactionNote: "sleepy",
};
const editProps: ComponentProps<typeof QuickMedicationForm> = {
  onSave: asyncSave,
  editingDose,
  onUpdate: async (input) => {
    const id: string = input.id;
    const scheduledTime: string | undefined = input.scheduledTime;
    void id;
    void scheduledTime;
  },
  onDelete: async (dose) => dose.id === editingDose.id,
  onCancelEdit: () => undefined,
};
const updatedDose = updateLocalDoseRecord(editingDose, { medicationName: "Amoxi", scheduledTime: "22:15", status: "completed" });
const updatedTime: string = updatedDose.scheduledAt;
const hydrated = createQuickMedicationEditState(editingDose);

if (hydrated.conditionName !== "Cough" || hydrated.medicationName !== "Amoxi" || hydrated.dosageLabel !== "1 tablet") {
  throw new Error("medication edit mode must load condition, medication, and dose labels");
}

if (hydrated.administeredAmount !== "0.5 tablet" || hydrated.reactionNote !== "sleepy" || hydrated.status !== "partial") {
  throw new Error("medication edit mode must load administered amount, note, and status");
}

if (hydrated.scheduledTime !== "21:10") {
  throw new Error("medication edit mode must load scheduled time");
}

const normalized = createQuickMedicationEditState({ ...editingDose, scheduledAt: "2026-06-28T7:05:00Z" });
if (normalized.scheduledTime !== "07:05") throw new Error("medication edit time must normalize to HH:mm");
if (!isValidDoseTime("23:59") || isValidDoseTime("24:00")) throw new Error("medication edit time validation must enforce HH:mm");
if (shouldCloseMedicationEditAfterDelete(false)) throw new Error("failed or cancelled medication delete must keep edit mode open");
if (!shouldCloseMedicationEditAfterDelete(true) || !shouldCloseMedicationEditAfterDelete(undefined)) throw new Error("successful medication delete must exit edit mode");
if (quickDoseSavedNoticeKey("skipped") !== "care.quickDoseSaved.skipped") throw new Error("dose status notice must preserve skipped copy");
if (createEmptyQuickMedicationState().status !== "completed") throw new Error("quick add form must keep completed as the default status");
if (careStatusActionLabel("completed") !== "먹였어요") throw new Error("completed action must use caregiver wording");
if (careStatusActionLabel("skipped") !== "못 먹였어요") throw new Error("skipped action must use caregiver wording");
if (shouldShowTemporaryMedicationForm(false) !== false || shouldShowTemporaryMedicationForm(true) !== true) {
  throw new Error("temporary medication form visibility must be explicit");
}

void asyncProps;
void syncProps;
void editProps;
void updatedTime;
