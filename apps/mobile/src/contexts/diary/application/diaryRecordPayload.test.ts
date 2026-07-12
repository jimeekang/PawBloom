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

if (payload.record_origin !== "diary") throw new Error("diary update payload must promote detailed edits to diary origin");
