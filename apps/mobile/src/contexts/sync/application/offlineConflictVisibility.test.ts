import { publishOfflineConflictChange, subscribeOfflineConflictChanges } from "./offlineConflictEvents";

declare const require: (name: string) => Record<string, (...args: string[]) => string>;
declare const process: { cwd: () => string };
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

let notifications = 0;
const unsubscribe = subscribeOfflineConflictChanges(() => { notifications += 1; });
publishOfflineConflictChange();
unsubscribe();
publishOfflineConflictChange();
if (notifications !== 1) throw new Error("offline conflict invalidations must notify active subscribers only");
const unsubscribeThrowing = subscribeOfflineConflictChanges(() => { throw new Error("subscriber failed"); });
const unsubscribeHealthy = subscribeOfflineConflictChanges(() => { notifications += 1; });
publishOfflineConflictChange();
unsubscribeThrowing();
unsubscribeHealthy();
if ((notifications as number) !== 2) throw new Error("one failing subscriber must not block replay completion or other subscribers");

const root = process.cwd();
const replayService = readFileSync(join(root, "apps/mobile/src/contexts/sync/application/offlineReplayService.ts"), "utf8");
const resolution = readFileSync(join(root, "apps/mobile/src/contexts/sync/application/offlineConflictResolution.ts"), "utf8");
const hook = readFileSync(join(root, "apps/mobile/src/contexts/sync/ui/useOfflineConflictCount.ts"), "utf8");
const notice = readFileSync(join(root, "apps/mobile/src/contexts/sync/ui/OfflineConflictNotice.tsx"), "utf8");
const shell = readFileSync(join(root, "apps/mobile/src/presentation/PawBloomShell.tsx"), "utf8");
const translations = readFileSync(join(root, "apps/mobile/src/i18n/translations.ts"), "utf8");

if (!replayService.includes("publishOfflineConflictChange")) {
  throw new Error("every replay completion must invalidate the visible conflict count");
}
if (!hook.includes("snapshot.userId === userId") || !hook.includes("request === latestRequest")) {
  throw new Error("the conflict UI must reject stale results after an account or request change");
}
if (!resolution.includes("clearConflictedMutations(userId)") || !resolution.includes("publishOfflineConflictChange")) {
  throw new Error("clearing reviewed conflicts must refresh the account-scoped visible count");
}
if (!notice.includes("confirmDestructiveAction") || !notice.includes("clearCurrentUserOfflineConflicts")) {
  throw new Error("parked conflict data must be cleared only through a confirmed user action");
}
if (!shell.includes("OfflineConflictNotice") || !shell.includes('key={userId ?? "signed-out"}')) {
  throw new Error("the signed-in shell must display a clear notice when offline conflicts need attention");
}
if (!translations.includes("newer synced server record") || !translations.includes("only parked local retry data")) {
  throw new Error("conflict resolution copy must explain server preservation and the local-only clear boundary");
}
