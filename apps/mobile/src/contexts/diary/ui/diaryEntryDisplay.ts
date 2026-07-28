import type { DiaryDetailInput, DiaryEntry } from "../domain/diaryEntry";
import { t, type TranslationKey } from "../../../i18n/translations";
import { isDefaultDiarySummary } from "../application/diarySummary";

// 표시용 요약은 현재 언어로 detail에서 재구성한다. detail이 없는 기록 중 사용자가 쓴 메모는 그대로,
// 내용 없이 저장된 기록의 자리표시 문구는 카테고리 라벨로 현재 언어에 맞춰 다시 그린다.
// Fields are optional so the vet report's timeline items (same shape, looser
// types) can reuse this without the report context importing diary internals.
export function getDiaryEntryDisplaySummary(entry: Partial<Pick<DiaryEntry, "summary" | "detail" | "memo" | "category">>): string {
  const category = entry.category ?? "memo";
  if (category === "photo") return t("category.photo");
  if (!entry.detail) return isDefaultDiarySummary(entry.summary) ? t(`category.${category}` as TranslationKey) : entry.summary ?? "";
  return [formatDiaryDetailSummary(entry.detail), entry.memo?.trim()].filter(Boolean).join(" · ") || (entry.summary ?? "");
}

export function formatDiaryDetailSummary(detail: DiaryDetailInput): string {
  if (detail.category === "food") {
    const mealParts = (Object.entries(detail.meals) as [string, { offeredGrams?: string; eatenGrams?: string }][])
      .filter(([, meal]) => meal.offeredGrams || meal.eatenGrams)
      .map(([slot, meal]) => `${t(`diary.meal.${slot}` as TranslationKey)} ${meal.eatenGrams || "-"}g/${meal.offeredGrams || "-"}g`);
    const appetite = detail.appetite ? t("diary.summary.appetite").replace("{label}", t(`diary.appetite.${detail.appetite}` as TranslationKey)) : "";
    return [...mealParts, appetite].filter(Boolean).join(", ");
  }
  if (detail.category === "water") {
    return [t("diary.summary.water").replace("{amount}", detail.amountMl || "-"), detail.intakeLevel ? t(`diary.level.${detail.intakeLevel}` as TranslationKey) : ""].filter(Boolean).join(", ");
  }
  if (detail.category === "walk") {
    return [
      t("diary.summary.walk").replace("{minutes}", detail.durationMinutes || "-"),
      detail.intensity ? t(`diary.intensity.${detail.intensity}` as TranslationKey) : "",
      detail.stoolObservation,
      detail.urineObservation,
      detail.symptomNote,
      detail.observation,
    ].filter(Boolean).join(", ");
  }
  if (detail.category === "stool") {
    return [
      t("diary.summary.stool").replace("{count}", detail.count || "-"),
      detail.consistency ? t(`diary.stool.${detail.consistency}` as TranslationKey) : "",
      detail.hasBloodOrMucus ? t("diary.summary.blood") : "",
    ].filter(Boolean).join(", ");
  }
  if (detail.category === "condition") {
    return [
      t("diary.summary.energy").replace("{label}", detail.energyLevel ? t(`diary.level.${detail.energyLevel}` as TranslationKey) : "-"),
      detail.discomfortNote,
    ].filter(Boolean).join(", ");
  }
  return "";
}
