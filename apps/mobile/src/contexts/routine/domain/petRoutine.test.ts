import { createDefaultPetRoutine } from "../application/petRoutineDefaults";
import { isValidMealReminderTime } from "./petRoutine";

if (!isValidMealReminderTime("08:30")) throw new Error("valid meal reminder time must be accepted");
for (const value of ["25:00", "8:30", "08:3", ""]) {
  if (isValidMealReminderTime(value)) throw new Error(`invalid meal reminder time must be rejected: ${value}`);
}

const routine = createDefaultPetRoutine("pet-1", "dog");
if (routine.food.mealRemindersEnabled !== true) throw new Error("meal reminders must default to enabled");
if (Object.values(routine.food.meals).some((meal) => meal?.localTime !== undefined)) throw new Error("meal reminder times must default to unset");
