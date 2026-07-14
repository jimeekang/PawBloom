import { buildDiaryUpdatePayload, diaryEntrySelect, mapDiaryRow, removeDiaryEntryFromList, upsertDiaryEntryInList } from "./diaryRecords";
import { pairDiaryRowsWithSignedPhotos } from "./diaryRecordQueries";

const payload = buildDiaryUpdatePayload({
  category: "food",
  summary: "ate well",
  detail: { category: "food", meals: { breakfast: { offeredGrams: "80", eatenGrams: "70" } }, appetite: "good" },
  entryDate: "2026-06-28",
  occurredTime: "08:15",
  id: "entry-1",
});

if ("entry_date" in payload || "category" in payload) throw new Error("update payload must keep the persisted date and category immutable");
if (payload.occurred_at !== new Date(2026, 5, 28, 8, 15, 0, 0).toISOString()) throw new Error("update payload must store edited time on the local selected date");
if (!String(payload.summary).includes("\"version\":1")) throw new Error("update payload must encode structured detail");
if (payload.record_origin !== "diary") throw new Error("diary update payload must persist record origin after the migration");
if (!diaryEntrySelect.includes("record_origin")) throw new Error("diary queries must select record_origin so checklist timeline records stay read-only");
if (!diaryEntrySelect.includes("storage_path")) throw new Error("diary queries must select photo storage paths so saved photos can be displayed");

const [photoRow] = pairDiaryRowsWithSignedPhotos([
  {
    id: "entry-photo",
    pet_id: "pet-1",
    category: "photo",
    occurred_at: "2026-07-14T10:00:00.000Z",
    summary: "",
    condition_score: null,
    entry_date: "2026-07-14",
    record_origin: "diary",
    created_by: "user-1",
    client_mutation_id: "mutation-1",
    created_at: "2026-07-14T10:00:00.000Z",
    updated_at: "2026-07-14T10:00:00.000Z",
    superseded_by: null,
    media_assets: [{ id: "asset-1", storage_path: "pet-1/diary/entry-photo/1.jpg" }],
  },
], [
  { path: "pet-1/diary/entry-photo/1.jpg", signedUrl: "https://example.test/photo.jpg", error: null },
]);
const photoEntry = photoRow ? mapDiaryRow(photoRow.row, photoRow.photoUrls) : undefined;

if (photoEntry?.photoUrls?.[0] !== "https://example.test/photo.jpg" || photoEntry.photoCount !== 1) {
  throw new Error("saved diary photo paths must map to displayable signed URLs without losing the photo count");
}

declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };
const { readFileSync } = require("node:fs") as { readFileSync(path: string, encoding: "utf8"): string };
const diaryEntryListSource = readFileSync(`${process.cwd()}/apps/mobile/src/contexts/diary/ui/DiaryEntryList.tsx`, "utf8");
if (!diaryEntryListSource.includes("entry.photoUrls") || !diaryEntryListSource.includes("<Modal")) {
  throw new Error("saved diary photos must render as thumbnails and open in a photo viewer");
}

const payloadWithoutTime = buildDiaryUpdatePayload({ category: "memo", summary: "same time", entryDate: "2026-06-28", id: "entry-2" });
if ("occurred_at" in payloadWithoutTime) throw new Error("update payload must not change occurred_at when edited time is omitted");

const remaining = removeDiaryEntryFromList([{ id: "keep" }, { id: "remove" }], "remove");
if (remaining.length !== 1 || remaining[0]?.id !== "keep") throw new Error("delete helper must remove only the matching diary entry");

const updated = upsertDiaryEntryInList([{ id: "move", entryDate: "2026-06-27" }, { id: "keep", entryDate: "2026-06-27" }], { id: "move", entryDate: "2026-06-28" });
if (updated.length !== 2 || updated[0]?.entryDate !== "2026-06-28" || updated[1]?.id !== "keep") throw new Error("update helper must replace an existing diary entry once");
