import type { DoseRecord } from "../domain/medication";
import { pendingRecordMutations } from "../../sync/application/pendingRecordMutations";
import { buildMedicationDoseReplayInsertPayload } from "./medicationOfflineReplay";
import { mapMedicationDoseInsertPayloadToRecord, mergeMedicationDoseUpdatePayloadIntoRecord, mergeSavedDoseIntoList } from "./medicationDosePayload";
import { toRecord } from "../../sync/application/offlineMutationPayload";
/** Server rows remain authoritative once the matching mutation has replayed; pending records overlay every refetch. */
export async function overlayPendingMedicationDoses(server: DoseRecord[], clientMutationIds: readonly (string | null)[], petId: string, userId: string | null | undefined, fromDateKey: string, toDateKey: string) {
  let rows = server;
  const applied = new Set(clientMutationIds);
  for (const mutation of await pendingRecordMutations(userId, petId, "medication")) {
    if (applied.has(mutation.clientMutationId)) continue;
    const input = toRecord(mutation.payload.input);
    if (mutation.operation === "insert") {
      const payload = buildMedicationDoseReplayInsertPayload({ petId, userId: userId!, clientMutationId: mutation.clientMutationId, input, insertPayload: toRecord(mutation.payload.insertPayload) });
      const dose = mapMedicationDoseInsertPayloadToRecord(payload, mutation.id);
      if (dose.doseDate! >= fromDateKey && dose.doseDate! <= toDateKey) rows = mergeSavedDoseIntoList(rows, dose);
    } else if (mutation.operation === "update") {
      rows = rows.map((dose) => dose.id === input.id ? mergeMedicationDoseUpdatePayloadIntoRecord(dose, toRecord(mutation.payload.updatePayload)) : dose);
    }
  }
  return rows.filter((dose) => dose.petId === petId && dose.doseDate! >= fromDateKey && dose.doseDate! <= toDateKey).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id.localeCompare(b.id));
}
