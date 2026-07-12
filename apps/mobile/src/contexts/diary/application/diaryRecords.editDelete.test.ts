import { buildDiaryUpdatePayload, diaryEntrySelect, removeDiaryEntryFromList, upsertDiaryEntryInList } from "./diaryRecords";

const payload = buildDiaryUpdatePayload({
  category: "food",
  summary: "ate well",
  detail: { category: "food", meals: { breakfast: { offeredGrams: "80", eatenGrams: "70" } }, appetite: "good" },
  entryDate: "2026-06-28",
  occurredTime: "08:15",
  id: "entry-1",
});

if (payload.entry_date !== "2026-06-28") throw new Error("update payload must keep selected date");
if (payload.occurred_at !== new Date(2026, 5, 28, 8, 15, 0, 0).toISOString()) throw new Error("update payload must store edited time on the local selected date");
if (!String(payload.summary).includes("\"version\":1")) throw new Error("update payload must encode structured detail");
if (payload.record_origin !== "diary") throw new Error("diary update payload must persist record origin after the migration");
if (!diaryEntrySelect.includes("record_origin")) throw new Error("diary queries must select record_origin so checklist timeline records stay read-only");

const payloadWithoutTime = buildDiaryUpdatePayload({ category: "memo", summary: "same time", entryDate: "2026-06-28", id: "entry-2" });
if ("occurred_at" in payloadWithoutTime) throw new Error("update payload must not change occurred_at when edited time is omitted");

const remaining = removeDiaryEntryFromList([{ id: "keep" }, { id: "remove" }], "remove");
if (remaining.length !== 1 || remaining[0]?.id !== "keep") throw new Error("delete helper must remove only the matching diary entry");

const updated = upsertDiaryEntryInList([{ id: "move", entryDate: "2026-06-27" }, { id: "keep", entryDate: "2026-06-27" }], { id: "move", entryDate: "2026-06-28" });
if (updated.length !== 2 || updated[0]?.entryDate !== "2026-06-28" || updated[1]?.id !== "keep") throw new Error("update helper must replace an existing diary entry once");
