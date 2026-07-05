import { readFileSync } from "node:fs";
import { join } from "node:path";

const file = join(process.cwd(), "apps/mobile/src/contexts/sync/application/offlineOutbox.ts");
const text = readFileSync(file, "utf8");
const required = ["clientMutationId", "insert or ignore", "initializeOutbox", "listPendingMutations", "markMutationApplied", "markMutationConflict", "markMutationRetry", "attempts"];
const missing = required.filter((needle) => !text.includes(needle));
const syncStatusText = readFileSync(join(process.cwd(), "apps/mobile/src/contexts/sync/application/syncStatus.ts"), "utf8");
const syncRequired = ["replayOutboxOnce", "isInternetReachable"];
const syncMissing = syncRequired.filter((needle) => !syncStatusText.includes(needle));

if (missing.length || syncMissing.length) {
  if (missing.length) console.error(`Offline outbox contract missing: ${missing.join(", ")}`);
  if (syncMissing.length) console.error(`Offline replay trigger missing: ${syncMissing.join(", ")}`);
  process.exit(1);
}

console.log("Offline sync verification passed.");
