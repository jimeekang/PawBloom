import { enqueueOfflineMutation } from "../../sync/application/offlineOutbox";
import type { DoseRecord } from "../domain/medication";
import { buildMedicationDoseInsertOfflineMutation, buildMedicationDoseUpdateOfflineMutation } from "./medicationOfflineReplay";
import { mapMedicationDoseInsertPayloadToRecord, mergeMedicationDoseUpdatePayloadIntoRecord, type MedicationDoseInsertPayload } from "./medicationDosePayload";

export async function enqueueMedicationDoseInsert(input: {
  petId: string;
  userId: string;
  formInput: Record<string, unknown>;
  insertPayload: MedicationDoseInsertPayload;
  clientMutationId: string;
}) {
  const mutation = buildMedicationDoseInsertOfflineMutation({
    petId: input.petId,
    userId: input.userId,
    input: input.formInput,
    insertPayload: input.insertPayload,
    clientMutationId: input.clientMutationId,
  });
  await enqueueOfflineMutation(mutation);
  return mapMedicationDoseInsertPayloadToRecord(input.insertPayload, mutation.id);
}

export async function enqueueMedicationDoseUpdate(input: {
  petId: string;
  formInput: Record<string, unknown>;
  updatePayload: Record<string, unknown>;
  clientMutationId: string;
  currentDose: DoseRecord;
}) {
  await enqueueOfflineMutation(buildMedicationDoseUpdateOfflineMutation({
    petId: input.petId,
    input: input.formInput,
    updatePayload: input.updatePayload,
    clientMutationId: input.clientMutationId,
  }));
  return mergeMedicationDoseUpdatePayloadIntoRecord(input.currentDose, input.updatePayload);
}
