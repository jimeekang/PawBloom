import { createDefaultPetRoutine } from "../application/petRoutineDefaults";
import { setMealRemindersEnabled, updateMealTime } from "./routineSettingsState";

const routine = createDefaultPetRoutine("pet-1", "dog");
const withTime = updateMealTime(routine, "breakfast", "08:30");
if (withTime.food.meals.breakfast?.localTime !== "08:30") throw new Error("meal time helper must set valid time");
if (updateMealTime(withTime, "breakfast", "9시").food.meals.breakfast?.localTime !== "08:30") throw new Error("meal time helper must preserve time for invalid input");
if (updateMealTime(withTime, "breakfast", undefined).food.meals.breakfast?.localTime !== undefined) throw new Error("meal time helper must clear time");
const disabled = setMealRemindersEnabled(withTime, false);
if (disabled.food.mealRemindersEnabled !== false || disabled.food.meals.breakfast?.localTime !== "08:30") throw new Error("meal reminder toggle must preserve food fields");
