import { getTimelineEntryRoute } from "./timelineRouting";

const baseEntry = {
  id: "entry-1",
  petId: "pet-1",
  category: "food" as const,
  entryDate: "2026-07-01",
  occurredAt: "08:00",
  summary: "record",
};

if (getTimelineEntryRoute({ ...baseEntry, origin: "diary" }) !== "diaryEdit") {
  throw new Error("diary-origin timeline entries must open diary edit");
}

if (getTimelineEntryRoute({ ...baseEntry, origin: "checklist" }) !== "checklistNotice") {
  throw new Error("checklist-origin timeline entries must not open diary edit");
}
