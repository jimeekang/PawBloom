import { buildRoutineDiaryDetail, createDefaultPetRoutine, getDiaryCategoriesForSpecies } from "./petRoutineRecords";

const routine = createDefaultPetRoutine("pet-routine-species-test");

if (getDiaryCategoriesForSpecies("dog").join(",") !== "food,water,walk,stool,condition,memo") {
  throw new Error("dog diary categories must include walk");
}

if (getDiaryCategoriesForSpecies("cat").includes("walk")) {
  throw new Error("cat diary categories must not include walk by default");
}

if (getDiaryCategoriesForSpecies("other").includes("walk")) {
  throw new Error("other animal diary categories must not include walk by default");
}

const walkDetail = buildRoutineDiaryDetail("walk", { ...routine, walk: { enabled: false, durationMinutes: "30", intensity: "normal" } });

if (walkDetail.category !== "walk" || walkDetail.durationMinutes !== undefined || walkDetail.intensity !== undefined) {
  throw new Error("disabled walk routine should not prefill walk detail");
}
