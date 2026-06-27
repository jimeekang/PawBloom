import type { DiaryDetailInput } from "../domain/diaryEntry";
import { decodeDiarySummary, encodeDiarySummary } from "./diaryRecords";

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

void displaySummary;
void breakfastEaten;
