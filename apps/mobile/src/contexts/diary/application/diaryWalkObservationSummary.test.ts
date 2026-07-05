import type { DiaryDetailInput } from "../domain/diaryEntry";
import { decodeDiarySummary, encodeDiarySummary } from "./diarySummary";

const walkDetail: DiaryDetailInput = {
  category: "walk",
  durationMinutes: "25",
  intensity: "normal",
  stoolObservation: "배변 없음",
  urineObservation: "소변 1회",
  symptomNote: "오른쪽 뒷다리 절뚝임",
};

const walkDecoded = decodeDiarySummary(encodeDiarySummary({ category: "walk", detail: walkDetail }), "walk");
if (!walkDecoded.summary.includes("배변 없음") || !walkDecoded.summary.includes("소변 1회") || !walkDecoded.summary.includes("오른쪽 뒷다리 절뚝임")) {
  throw new Error("walk diary summary must include stool, urine, and symptom observations");
}
