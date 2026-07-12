import type { DiaryRecordOrigin } from "../domain/diaryEntry";

export function inferDiaryRecordOrigin({
  storedOrigin,
  summary,
}: {
  storedOrigin?: string | null;
  summary: string;
}): DiaryRecordOrigin {
  if (storedOrigin === "diary" || storedOrigin === "checklist") return storedOrigin;
  return summary.includes("체크리스트가 기록되었습니다.") ? "checklist" : "diary";
}
