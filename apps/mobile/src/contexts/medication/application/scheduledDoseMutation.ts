import { getPetMutationTarget } from "../../pet/application/petMutationTarget";
import type { QueryClient } from "@tanstack/react-query";
import type { DoseRecord } from "../domain/medication";
import type { QuickMedicationDoseInput } from "./medicationDoseRecords";
type Result = { dose: DoseRecord; queued: boolean };
const queuedResults = new WeakMap<QueryClient, Map<string, string>>();
const inFlight = new Map<string, Promise<Result>>();
/** A schedule/date identity is completed once. Explicit edits use the update use case. */
export function deduplicateScheduledDose(client: QueryClient, petId: string | null, userId: string | null, input: QuickMedicationDoseInput, create: () => Promise<Result>): Promise<Result> {
  if (!input.scheduleId || !input.doseDate) return create();
  const key = JSON.stringify([userId, petId, getPetMutationTarget(input)?.epoch, input.scheduleId, input.doseDate]);
  const pending = inFlight.get(key);
  if (pending) return pending;
  for (const [queryKey, rows] of client.getQueriesData<DoseRecord[]>({ queryKey: ["medication_doses"] })) {
    if (queryKey[2] !== petId || queryKey.at(-1) !== userId) continue;
    const existing = rows?.find((dose) => !dose.id.startsWith("dose-optimistic-") && dose.petId === petId && dose.scheduleId === input.scheduleId && dose.doseDate === input.doseDate);
    if (existing) return Promise.resolve({ dose: existing, queued: queuedResults.get(client)?.get(key) === existing.id });
  }
  const promise = create().then((result) => {
    let queued = queuedResults.get(client); if (!queued) { queued = new Map(); queuedResults.set(client, queued); }
    if (result.queued) queued.set(key, result.dose.id); else queued.delete(key);
    return result;
  }).finally(() => { if (inFlight.get(key) === promise) inFlight.delete(key); });
  inFlight.set(key, promise);
  return promise;
}
