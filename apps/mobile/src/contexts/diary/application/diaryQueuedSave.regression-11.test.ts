declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as { readFileSync(path: string, encoding: "utf8"): string };
const root = process.cwd();
const records = readFileSync(`${root}/apps/mobile/src/contexts/diary/application/diaryRecords.ts`, "utf8");
const controller = readFileSync(`${root}/apps/mobile/src/contexts/diary/ui/useDiaryEntriesController.ts`, "utf8");
const screen = readFileSync(`${root}/apps/mobile/src/contexts/diary/ui/DiaryEntryScreen.tsx`, "utf8");

if (!/await enqueueOfflineMutation\([\s\S]*?return \{ entry: mapQueuedDiaryEntry\(payload, clientMutationId\), queued: true \}/.test(records)) {
  throw new Error("a successfully queued diary mutation must resolve with queued status instead of throwing a save failure");
}
if (!controller.includes("resolveRemoteDiarySaveOutcome(result.queued)") || !controller.includes('outcome === "queued" ? "today.diaryQueued"')) {
  throw new Error("the diary controller must expose queued saves as a distinct successful outcome and notice");
}
if (!screen.includes('outcome === "queued" ? "diary.queuedForSync"')) {
  throw new Error("the diary form must show offline queue acceptance instead of the generic saved or failed notice");
}
