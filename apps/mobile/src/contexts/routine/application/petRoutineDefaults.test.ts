import type { PetRoutine } from "../domain/petRoutine";
import { buildRoutineDiaryDetail, createDefaultPetRoutine } from "./petRoutineRecords";

const defaults: PetRoutine = createDefaultPetRoutine("pet-routine-test");
const foodDetail = buildRoutineDiaryDetail("food", defaults);
const waterDetail = buildRoutineDiaryDetail("water", {
  ...defaults,
  water: { amountMl: "350", intakeLevel: "normal" },
});

const breakfastTarget: string | undefined = foodDetail.category === "food" ? foodDetail.meals.breakfast?.offeredGrams : undefined;
const waterTarget: string | undefined = waterDetail.category === "water" ? waterDetail.amountMl : undefined;

void breakfastTarget;
void waterTarget;
