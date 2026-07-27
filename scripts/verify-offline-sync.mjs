import { readFileSync } from "node:fs";
import { join } from "node:path";

const file = join(process.cwd(), "apps/mobile/src/contexts/sync/application/offlineOutbox.ts");
const text = readFileSync(file, "utf8");
const required = ["clientMutationId", "insert or ignore", "initializeOutbox", "listPendingMutations", "markMutationApplied", "markMutationConflict", "markMutationRetry", "attempts"];
const missing = required.filter((needle) => !text.includes(needle));
const syncStatusText = readFileSync(join(process.cwd(), "apps/mobile/src/contexts/sync/application/syncStatus.ts"), "utf8");
const syncRequired = ["replayOutboxOnce", "isInternetReachable"];
const syncMissing = syncRequired.filter((needle) => !syncStatusText.includes(needle));

// syncStatus wires onlineManager to NetInfo, so React Query's default
// networkMode ("online") would pause every mutation while offline — and the
// outbox enqueue lives inside mutationFn. Without networkMode "always" the
// queue never receives the write and paused queries read as "no records".
const appText = readFileSync(join(process.cwd(), "apps/mobile/App.tsx"), "utf8");
const networkModeCount = (appText.match(/networkMode:\s*"always"/g) ?? []).length;
const networkModeMissing = networkModeCount < 2;

if (missing.length || syncMissing.length || networkModeMissing) {
  if (missing.length) console.error(`Offline outbox contract missing: ${missing.join(", ")}`);
  if (syncMissing.length) console.error(`Offline replay trigger missing: ${syncMissing.join(", ")}`);
  if (networkModeMissing) console.error('QueryClient must set networkMode: "always" for both queries and mutations so offline writes reach the outbox');
  process.exit(1);
}

console.log("Offline sync verification passed.");
