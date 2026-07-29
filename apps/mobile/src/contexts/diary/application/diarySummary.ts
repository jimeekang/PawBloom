import type { DiaryCategory, DiaryDetailInput } from "../domain/diaryEntry";

export function encodeDiarySummary(input: { category: DiaryCategory; memo?: string; detail?: DiaryDetailInput }) {
  const memo = input.memo?.trim() ?? "";
  return input.detail ? JSON.stringify({ version: 1, category: input.category, memo, detail: input.detail }) : memo;
}

export function decodeDiarySummary(value: string, fallbackCategory: DiaryCategory): { summary: string; memo?: string; detail?: DiaryDetailInput } {
  try {
    const parsed = JSON.parse(value) as { version?: number; memo?: string; detail?: DiaryDetailInput };
    return parsed.version === 1 && parsed.detail ? { summary: buildDetailSummary(parsed.detail, parsed.memo), memo: parsed.memo?.trim() || undefined, detail: parsed.detail } : { summary: value };
  } catch {
    return { summary: value || defaultDiarySummary(fallbackCategory) };
  }
}

// New empty records store no language-bearing copy. These are legacy values
// from older clients; readers translate them from the row category instead.
const LEGACY_DEFAULT_SUMMARIES = new Set([
  "식사가 기록되었습니다.", "물 섭취가 기록되었습니다.", "산책이 기록되었습니다.", "배변이 기록되었습니다.", "컨디션 체크가 기록되었습니다.", "메모가 기록되었습니다.", "사진이 기록되었습니다.",
  "잘 먹음", "물 섭취 기록", "산책 완료", "배변 기록", "컨디션 확인", "메모 추가", "사진 추가",
  "Food checklist recorded.", "Water checklist recorded.", "Walk checklist recorded.", "Stool checklist recorded.", "Condition checklist recorded.", "Memo checklist recorded.",
  "식사 체크리스트가 기록되었습니다.", "물 섭취 체크리스트가 기록되었습니다.", "산책 체크리스트가 기록되었습니다.", "배변 체크리스트가 기록되었습니다.", "컨디션 체크리스트가 기록되었습니다.", "메모 체크리스트가 기록되었습니다.",
]);

export function defaultDiarySummary(_category: DiaryCategory) {
  return "";
}

export function isDefaultDiarySummary(value: string | undefined) {
  return !value?.trim() || LEGACY_DEFAULT_SUMMARIES.has(value.trim());
}

function buildDetailSummary(detail: DiaryDetailInput, memo?: string) {
  return [detailSummary(detail), memo?.trim()].filter(Boolean).join(" · ");
}

function detailSummary(detail: DiaryDetailInput) {
  if (detail.category === "food") {
    const mealParts = (Object.entries(detail.meals) as [string, { offeredGrams?: string; eatenGrams?: string }][])
      .filter(([, meal]) => meal.offeredGrams || meal.eatenGrams)
      .map(([slot, meal]) => `${mealLabel(slot)} ${meal.eatenGrams || "-"}g/${meal.offeredGrams || "-"}g`);
    return [...mealParts, detail.appetite ? `식욕 ${appetiteLabel(detail.appetite)}` : ""].filter(Boolean).join(", ");
  }
  if (detail.category === "water") return [`물 ${detail.amountMl || "-"}ml`, detail.intakeLevel ? levelLabel(detail.intakeLevel) : ""].filter(Boolean).join(", ");
  if (detail.category === "walk") return [`산책 ${detail.durationMinutes || "-"}분`, detail.intensity ? intensityLabel(detail.intensity) : "", detail.stoolObservation, detail.urineObservation, detail.symptomNote, detail.observation].filter(Boolean).join(", ");
  if (detail.category === "stool") return [`배변 ${detail.count || "-"}회`, detail.consistency ? stoolLabel(detail.consistency) : "", detail.hasBloodOrMucus ? "혈변/점액 관찰" : ""].filter(Boolean).join(", ");
  if (detail.category === "condition") return [`에너지 ${detail.energyLevel ? levelLabel(detail.energyLevel) : "-"}`, detail.discomfortNote].filter(Boolean).join(", ");
  return "";
}

function mealLabel(slot: string) { return ({ breakfast: "아침", lunch: "점심", dinner: "저녁", snack: "간식" } as Record<string, string>)[slot] ?? slot; }
function appetiteLabel(value: string) { return ({ good: "좋음", normal: "보통", low: "적음", refused: "거부" } as Record<string, string>)[value] ?? value; }
function levelLabel(value: string) { return ({ less: "적음", normal: "정상", more: "많음" } as Record<string, string>)[value] ?? value; }
function intensityLabel(value: string) { return ({ low: "낮음", normal: "보통", high: "높음" } as Record<string, string>)[value] ?? value; }
function stoolLabel(value: string) { return ({ normal: "정상변", soft: "무른변", diarrhea: "설사", hard: "딱딱함" } as Record<string, string>)[value] ?? value; }
