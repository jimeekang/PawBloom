import { formatReportMissingRecord, formatReportTimelineItem, formatReportVetQuestion } from "./reportDraftDisplay";

if (formatReportMissingRecord("noFood") !== "식사·식욕 기록이 없습니다.") {
  throw new Error("missing-record kinds must localize (default harness language is Korean)");
}

if (!formatReportVetQuestion("medication").includes("스케줄 조정이 필요한지")) {
  throw new Error("vet-question kinds must localize");
}

const diaryLine = formatReportTimelineItem(
  { kind: "diary", dateKey: "2026-06-28", time: "09:00", category: "condition", summary: "More alert" },
  "ko",
);
if (diaryLine !== "2026년 6월 28일 09:00 · 컨디션: More alert") {
  throw new Error(`diary timeline items must render localized date and category label, got: ${diaryLine}`);
}

const doseLine = formatReportTimelineItem(
  { kind: "medication", dateKey: "2026-06-28", time: "12:30", medicationName: "Cerenia", status: "partial", administeredAmount: "1/2" },
  "en",
);
if (!doseLine.startsWith("Jun 28, 2026 12:30 · ") || !doseLine.includes("Cerenia")) {
  throw new Error(`medication timeline items must render the localized date, name, and status, got: ${doseLine}`);
}

const undatedDose = formatReportTimelineItem({ kind: "medication", time: "08:30", medicationName: "Cerenia", status: "pending" }, "ko");
if (!undatedDose.startsWith("08:30 · ")) {
  throw new Error("items without a date key must render time-only instead of a broken date");
}
