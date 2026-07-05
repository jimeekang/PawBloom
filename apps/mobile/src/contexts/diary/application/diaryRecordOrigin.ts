import type { DiaryRecordOrigin } from "../domain/diaryEntry";

export function inferDiaryRecordOrigin({
  storedOrigin,
  summary,
}: {
  storedOrigin?: DiaryRecordOrigin | null;
  summary: string;
}): DiaryRecordOrigin {
  if (storedOrigin) return storedOrigin;
  return summary.includes("체크리스트가 기록되었습니다.") ? "checklist" : "diary";
}
