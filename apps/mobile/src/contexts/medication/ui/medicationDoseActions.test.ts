import { Alert } from "react-native";
import type { DoseRecord } from "../domain/medication";
import { confirmAndDeleteMedicationDose, hasRecordedMedication, saveMedicationDoseEdit } from "./medicationDoseActions";

const dose: DoseRecord = {
  id: "dose-action-1",
  petId: "pet-1",
  medicationName: "Amoxi",
  scheduledAt: "08:00",
  status: "pending",
};

let doses: DoseRecord[] = [dose];
let medicationRecorded = false;
let notice = "";
let feedbackCount = 0;

const common = {
  activePetId: "pet-1",
  setDoses: (updater: DoseRecord[] | ((current: DoseRecord[]) => DoseRecord[])) => {
    doses = typeof updater === "function" ? updater(doses) : updater;
  },
  onLocalDosesChanged: (nextDoses: DoseRecord[]) => {
    medicationRecorded = hasRecordedMedication(nextDoses, "pet-1");
  },
  setNotice: (next: string) => {
    notice = next;
  },
  onSaved: () => {
    feedbackCount += 1;
  },
};

async function exerciseLocalUpdate() {
  await saveMedicationDoseEdit({
    ...common,
    databaseMode: false,
    input: { id: dose.id, medicationName: "Amoxi", status: "completed", scheduledTime: "09:30" },
    updateMedicationDose: { mutateAsync: async () => undefined },
  });

  if (doses[0]?.status !== "completed" || doses[0]?.scheduledAt !== "09:30") throw new Error("local medication edit must update dose content");
  if (!medicationRecorded) throw new Error("local medication edit must notify dose changes for checklist recalculation");
}

async function exerciseRemoteUpdateFailure() {
  try {
    await saveMedicationDoseEdit({
      ...common,
      databaseMode: true,
      input: { id: dose.id, medicationName: "Amoxi", status: "partial" },
      updateMedicationDose: { mutateAsync: async () => { throw new Error("network failed"); } },
    });
    throw new Error("remote medication edit failure must rethrow so the edit form stays open");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("network")) throw error;
  }
}

async function exerciseConfirmedDelete() {
  const originalAlert = Alert.alert;
  Alert.alert = ((_title, _message, buttons) => {
    buttons?.[1]?.onPress?.();
  }) as typeof Alert.alert;

  try {
    const deleted = await confirmAndDeleteMedicationDose({
      ...common,
      databaseMode: false,
      dose,
      deleteMedicationDose: { mutateAsync: async () => undefined },
    });
    if (!deleted || doses.some((item) => item.id === dose.id)) throw new Error("confirmed medication delete must remove dose");
  } finally {
    Alert.alert = originalAlert;
  }
}

void exerciseLocalUpdate();
void exerciseRemoteUpdateFailure();
void exerciseConfirmedDelete();
void notice;
void feedbackCount;
