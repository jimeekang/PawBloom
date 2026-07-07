import type { DiaryCategory, DiaryDetailInput } from "../domain/diaryEntry";
import type { PetRoutine } from "../../routine/domain/petRoutine";
import type { Species } from "../../pet/domain/pet";

export function getDiaryCategoriesForSpecies(species: Species, walkEnabled = species === "dog"): DiaryCategory[] {
  return walkEnabled
    ? ["food", "water", "walk", "stool", "condition", "memo", "photo"]
    : ["food", "water", "stool", "condition", "memo", "photo"];
}

export function buildRoutineDiaryDetail(category: DiaryCategory, routine: PetRoutine): DiaryDetailInput {
  if (category === "food") return { category, meals: routine.food.meals, appetite: routine.food.appetite };
  if (category === "water") return { category, amountMl: routine.water.amountMl, intakeLevel: routine.water.intakeLevel };
  if (category === "walk") return routine.walk.enabled === false ? { category } : { category, durationMinutes: routine.walk.durationMinutes, intensity: routine.walk.intensity };
  if (category === "stool") return { category, count: routine.stool.count, consistency: routine.stool.consistency, hasBloodOrMucus: false };
  if (category === "condition") return { category, energyLevel: routine.condition.energyLevel };
  return { category: "memo" };
}
