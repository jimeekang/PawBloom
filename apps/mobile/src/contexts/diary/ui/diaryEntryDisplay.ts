import type { DiaryDetailInput, DiaryEntry } from "../domain/diaryEntry";
import { t, type TranslationKey } from "../../../i18n/translations";

// 표시용 요약은 현재 언어로 detail에서 재구성한다. detail이 없는 기록(메모·레거시)은 저장된 summary를 그대로 쓴다.
export function getDiaryEntryDisplaySummary(entry: Pick<DiaryEntry, "summary" | "detail" | "memo" | "category">): string {
  if (entry.category === "photo") return t("ko", "category.photo");
  if (!entry.detail) return entry.summary;
  return [formatDiaryDetailSummary(entry.detail), entry.memo?.trim()].filter(Boolean).join(" · ") || entry.summary;
}

export function formatDiaryDetailSummary(detail: DiaryDetailInput): string {
  if (detail.category === "food") {
    const mealParts = (Object.entries(detail.meals) as [string, { offeredGrams?: string; eatenGrams?: string }][])
      .filter(([, meal]) => meal.offeredGrams || meal.eatenGrams)
      .map(([slot, meal]) => `${t("ko", `diary.meal.${slot}` as TranslationKey)} ${meal.eatenGrams || "-"}g/${meal.offeredGrams || "-"}g`);
    const appetite = detail.appetite ? t("ko", "diary.summary.appetite").replace("{label}", t("ko", `diary.appetite.${detail.appetite}` as TranslationKey)) : "";
    return [...mealParts, appetite].filter(Boolean).join(", ");
  }
  if (detail.category === "water") {
    return [t("ko", "diary.summary.water").replace("{amount}", detail.amountMl || "-"), detail.intakeLevel ? t("ko", `diary.level.${detail.intakeLevel}` as TranslationKey) : ""].filter(Boolean).join(", ");
  }
  if (detail.category === "walk") {
    return [
      t("ko", "diary.summary.walk").replace("{minutes}", detail.durationMinutes || "-"),
      detail.intensity ? t("ko", `diary.intensity.${detail.intensity}` as TranslationKey) : "",
      detail.stoolObservation,
      detail.urineObservation,
      detail.symptomNote,
      detail.observation,
    ].filter(Boolean).join(", ");
  }
  if (detail.category === "stool") {
    return [
      t("ko", "diary.summary.stool").replace("{count}", detail.count || "-"),
      detail.consistency ? t("ko", `diary.stool.${detail.consistency}` as TranslationKey) : "",
      detail.hasBloodOrMucus ? t("ko", "diary.summary.blood") : "",
    ].filter(Boolean).join(", ");
  }
  if (detail.category === "condition") {
    return [
      t("ko", "diary.summary.energy").replace("{label}", detail.energyLevel ? t("ko", `diary.level.${detail.energyLevel}` as TranslationKey) : "-"),
      detail.discomfortNote,
    ].filter(Boolean).join(", ");
  }
  return "";
}
