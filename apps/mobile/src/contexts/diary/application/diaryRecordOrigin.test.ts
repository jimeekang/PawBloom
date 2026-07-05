import { inferDiaryRecordOrigin } from "./diaryRecordOrigin";

if (inferDiaryRecordOrigin({ storedOrigin: "checklist", summary: "record" }) !== "checklist") {
  throw new Error("stored checklist origin must be preserved when the database has record_origin");
}

if (inferDiaryRecordOrigin({ summary: "식사 체크리스트가 기록되었습니다." }) !== "checklist") {
  throw new Error("checklist origin must be inferred while the live database lacks record_origin");
}

if (inferDiaryRecordOrigin({ summary: "아침 80g/100g" }) !== "diary") {
  throw new Error("normal diary summaries must remain diary origin");
}
