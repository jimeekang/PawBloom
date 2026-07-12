import { publishOfflineConflictChange } from "./offlineConflictEvents";
import { clearConflictedMutations } from "./offlineOutbox";

export async function clearCurrentUserOfflineConflicts(userId: string) {
  await clearConflictedMutations(userId);
  publishOfflineConflictChange();
}
