import type { PetRoutine } from "../../routine/domain/petRoutine";
import { createDefaultPetRoutine } from "../../routine/application/petRoutineDefaults";
import { buildRoutineDiaryDetail, getDiaryCategoriesForSpecies } from "./diaryFormDefaults";

const defaults: PetRoutine = createDefaultPetRoutine("pet-routine-test");
const foodDetail = buildRoutineDiaryDetail("food", defaults);
const waterDetail = buildRoutineDiaryDetail("water", {
  ...defaults,
  water: { amountMl: "350", intakeLevel: "normal" },
});

const breakfastTarget: string | undefined = foodDetail.category === "food" ? foodDetail.meals.breakfast?.offeredGrams : undefined;
const lunchTarget: string | undefined = foodDetail.category === "food" ? foodDetail.meals.lunch?.offeredGrams : undefined;
const waterTarget: string | undefined = waterDetail.category === "water" ? waterDetail.amountMl : undefined;

void breakfastTarget;
if (foodDetail.category !== "food" || !("lunch" in foodDetail.meals)) {
  throw new Error("food routine defaults must include lunch so profile and diary meal slots match");
}
void lunchTarget;
void waterTarget;

if (getDiaryCategoriesForSpecies("dog").join(",") !== "food,water,walk,stool,condition,memo,photo") {
  throw new Error("dog diary categories must include walk");
}

if (getDiaryCategoriesForSpecies("cat").includes("walk")) {
  throw new Error("cat diary categories must not include walk by default");
}

if (getDiaryCategoriesForSpecies("other").includes("walk")) {
  throw new Error("other animal diary categories must not include walk by default");
}

const walkDetail = buildRoutineDiaryDetail("walk", { ...defaults, walk: { enabled: false, durationMinutes: "30", intensity: "normal" } });

if (walkDetail.category !== "walk" || walkDetail.durationMinutes !== undefined || walkDetail.intensity !== undefined) {
  throw new Error("disabled walk routine should not prefill walk detail");
}
