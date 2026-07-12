import type { PetRoutine, RoutineMealSlot } from "../domain/petRoutine";
import { isValidMealReminderTime } from "../domain/petRoutine";

export function updateMealTime(draft: PetRoutine, slot: RoutineMealSlot, localTime: string | undefined): PetRoutine {
  if (localTime !== undefined && !isValidMealReminderTime(localTime)) return draft;
  return {
    ...draft,
    food: {
      ...draft.food,
      meals: {
        ...draft.food.meals,
        [slot]: { ...draft.food.meals[slot], ...(localTime === undefined ? { localTime: undefined } : { localTime }) },
      },
    },
  };
}

export function setMealRemindersEnabled(draft: PetRoutine, enabled: boolean): PetRoutine {
  return { ...draft, food: { ...draft.food, mealRemindersEnabled: enabled } };
}
