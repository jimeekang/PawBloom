import { applyMealReminderPlan, buildMealReminderPlan, mealReminderIdentifier, selectMealRemindersToCancel, setActiveMealReminderAccount, shouldCancelMealReminderForAccount, rescheduleMealReminders } from "./mealReminderNotifications";
import { createDefaultPetRoutine } from "./petRoutineDefaults";

const routine = createDefaultPetRoutine("pet-1", "dog");
routine.food.meals = {
  breakfast: { offeredGrams: "100", localTime: "08:30" },
  lunch: { localTime: "9시" },
  dinner: { localTime: "19:05" },
};
const plan = buildMealReminderPlan({ userId: "user-1", petId: "pet-1", petName: "Mandu", title: "Mandu meal time", slotLabels: { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" }, routine });
if (plan.length !== 2 || plan[0]?.identifier !== mealReminderIdentifier("user-1", "pet-1", "breakfast")) throw new Error("meal plan must include only valid scheduled meals");
if (plan[0]?.trigger.hour !== 8 || plan[0]?.trigger.minute !== 30 || plan[0]?.body !== "Breakfast" || !plan[0]?.title.includes("Mandu")) throw new Error("meal plan must preserve time and copy");
if (plan[1]?.slot !== "dinner") throw new Error("meal plan must retain meal slot order");
routine.food.mealRemindersEnabled = false;
if (buildMealReminderPlan({ userId: "user-1", petId: "pet-1", petName: "Mandu", title: "Mandu meal time", slotLabels: {}, routine }).length !== 0) throw new Error("disabled meal reminders must produce no plan");
routine.food.mealRemindersEnabled = true;

const pending = [
  { identifier: "meal:user-1:pet-1:breakfast" },
  { identifier: "meal:user-1:pet-1:snack" },
  { identifier: "meal:user-1:pet-2:breakfast" },
  { identifier: "meal:user-2:pet-1:breakfast" },
  { identifier: "medication:user-1:pet-1:daily" },
];
const cancellation = selectMealRemindersToCancel(pending, { userId: "user-1", petId: "pet-1", keepIdentifiers: new Set(["meal:user-1:pet-1:breakfast"]) });
if (cancellation.length !== 1 || cancellation[0]?.identifier !== "meal:user-1:pet-1:snack") throw new Error("meal cancellation must stay within account and pet namespace");
if (!shouldCancelMealReminderForAccount({ identifier: "meal:user-1:pet-1:breakfast" }, "user-1")) throw new Error("owned meal reminder must be cancellable");
if (shouldCancelMealReminderForAccount({ identifier: "meal:user-2:pet-1:breakfast" }, "user-1") || shouldCancelMealReminderForAccount({ identifier: "medication:user-1:pet-1:daily" }, "user-1")) throw new Error("foreign and medication reminders must not be canceled as meals");

const installed: string[] = [];
const canceled: string[] = [];
await applyMealReminderPlan(plan, pending, { userId: "user-1", petId: "pet-1" }, { schedule: async (request) => { installed.push(request.identifier); }, cancel: async (identifier) => { canceled.push(identifier); } });
if (installed.length !== 2 || canceled.length !== 1 || canceled[0] !== "meal:user-1:pet-1:snack") throw new Error("meal plan application must install desired and cancel obsolete reminders");

setActiveMealReminderAccount("user-2");
if (await rescheduleMealReminders({ userId: "user-1", petId: "pet-1", petName: "Mandu", title: "Mandu meal time", slotLabels: {}, routine, requestPermission: true })) throw new Error("stale meal reminder account must not reschedule");
