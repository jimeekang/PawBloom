import { buildDiaryUpdatePayload } from "./diaryRecordPayload";

const payload = buildDiaryUpdatePayload({
  category: "food",
  summary: "ate well",
  detail: { category: "food", meals: { breakfast: { offeredGrams: "80", eatenGrams: "70" } }, appetite: "good" },
  entryDate: "2026-06-28",
  occurredTime: "08:15",
  origin: "diary",
  id: "entry-1",
});

if ("record_origin" in payload) {
  throw new Error("diary update payload must not require record_origin until the live database has the migration");
}
