import type { PetRoutine } from "../domain/petRoutine";
import { buildRoutineDiaryDetail, createDefaultPetRoutine } from "./petRoutineRecords";

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
