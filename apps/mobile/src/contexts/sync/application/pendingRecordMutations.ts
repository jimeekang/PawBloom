import { listPendingMutations } from "./offlineOutbox";
import type { OfflineMutation } from "../domain/offlineMutation";
/** Read the existing account-owned outbox; foreign/missing owner envelopes cannot enter a query cache. */
export async function pendingRecordMutations(userId: string | null | undefined, petId: string, aggregate: string, read = listPendingMutations): Promise<OfflineMutation[]> {
  if (!userId) return [];
  return (await read()).filter((mutation) => mutation.queuedByUserId === userId && mutation.aggregate === aggregate && mutation.payload.petId === petId && (mutation.payload.userId === undefined || mutation.payload.userId === userId));
}
