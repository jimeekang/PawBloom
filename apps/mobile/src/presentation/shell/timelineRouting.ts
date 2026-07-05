import type { DiaryEntry } from "../../contexts/diary/domain/diaryEntry";

export type TimelineEntryRoute = "diaryEdit" | "checklistNotice";

export function getTimelineEntryRoute(entry: DiaryEntry): TimelineEntryRoute {
  return entry.origin === "checklist" ? "checklistNotice" : "diaryEdit";
}
