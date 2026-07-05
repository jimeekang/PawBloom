import type { DiaryDetailInput } from "../domain/diaryEntry";
import { decodeDiarySummary, encodeDiarySummary, mapDiaryRow } from "./diaryRecords";

const foodDetail: DiaryDetailInput = {
  category: "food",
  meals: {
    breakfast: { offeredGrams: "80", eatenGrams: "60" },
    dinner: { offeredGrams: "90", eatenGrams: "90" },
  },
  appetite: "normal",
};

const encoded = encodeDiarySummary({ category: "food", memo: "Ate slowly.", detail: foodDetail });
const decoded = decodeDiarySummary(encoded, "food");

const displaySummary: string = decoded.summary;
const breakfastEaten: string | undefined = decoded.detail?.category === "food" ? decoded.detail.meals.breakfast?.eatenGrams : undefined;

const checklistMapped = mapDiaryRow({
  id: "entry-checklist",
  pet_id: "pet-1",
  category: "food",
  occurred_at: "2026-07-01T08:00:00.000Z",
  summary: "식사 체크리스트가 기록되었습니다.",
  condition_score: null,
  entry_date: "2026-07-01",
  created_by: "user-1",
  client_mutation_id: null,
  created_at: "2026-07-01T08:00:00.000Z",
  updated_at: "2026-07-01T08:00:00.000Z",
  record_origin: "checklist",
  media_assets: [],
});

if (checklistMapped.origin !== "checklist") {
  throw new Error("diary row mapping must preserve checklist origin");
}

const legacyChecklistMapped = mapDiaryRow({
  id: "entry-checklist-legacy",
  pet_id: "pet-1",
  category: "food",
  occurred_at: "2026-07-01T08:00:00.000Z",
  summary: "식사 체크리스트가 기록되었습니다.",
  condition_score: null,
  entry_date: "2026-07-01",
  created_by: "user-1",
  client_mutation_id: null,
  created_at: "2026-07-01T08:00:00.000Z",
  updated_at: "2026-07-01T08:00:00.000Z",
  media_assets: [],
} as unknown as Parameters<typeof mapDiaryRow>[0]);

if (legacyChecklistMapped.origin !== "checklist") {
  throw new Error("diary row mapping must infer checklist origin while the live database lacks record_origin");
}

void displaySummary;
void breakfastEaten;
