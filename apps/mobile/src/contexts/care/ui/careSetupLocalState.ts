import { getLocalDateKey } from "../../../shared-kernel/date";
import type { ActiveCareSetup, CareMedicationSchedule, CareSetupInput } from "../domain/carePlan";

export function buildNextLocalCareSetup(current: ActiveCareSetup, input: CareSetupInput, timestamp = Date.now()): ActiveCareSetup {
  const conditionName = input.conditionName.trim();
  const existingCondition = current.conditions.find((condition) => condition.id === input.conditionId)
    ?? current.conditions.find((condition) => condition.name === conditionName);
  const condition = conditionName
    ? { id: existingCondition?.id ?? `local-condition-${timestamp}`, name: conditionName, status: "active" as const, startsOn: input.startsOn || existingCondition?.startsOn, endsOn: input.endsOn || undefined }
    : existingCondition;
  const conditions = condition
    ? [condition, ...current.conditions.filter((item) => item.id !== condition.id)]
    : current.conditions;

  const planTitle = input.planTitle.trim();
  const shouldSavePlan = Boolean(input.planId || planTitle || conditionName);
  const currentPlans = current.plans.length > 0 ? current.plans : current.plan ? [current.plan] : [];
  const existingPlan = input.planId
    ? currentPlans.find((item) => item.id === input.planId)
    : currentPlans.find((item) => item.conditionId === condition?.id);
  const plan = shouldSavePlan
    ? {
        id: existingPlan?.id ?? input.planId ?? `local-plan-${timestamp}`,
        conditionId: condition?.id,
        title: planTitle || conditionName || existingPlan?.title || "Care plan",
        instructions: input.instructions ?? existingPlan?.instructions,
        startsOn: input.startsOn || existingPlan?.startsOn,
        endsOn: input.endsOn || undefined,
      }
    : undefined;
  const plans = plan
    ? [plan, ...currentPlans.filter((item) => item.id !== plan.id)]
    : currentPlans;

  const schedules = input.medicationName.trim()
    ? upsertLocalSchedules(current.schedules, input, condition?.id, conditionName, timestamp)
    : current.schedules;

  return {
    conditions,
    plans,
    condition,
    plan: plan ?? current.plan,
    conditionName: conditionName || condition?.name,
    planTitle: plan?.title ?? current.plan?.title,
    instructions: plan?.instructions ?? current.plan?.instructions,
    schedules,
  };
}

function upsertLocalSchedules(current: CareMedicationSchedule[], input: CareSetupInput, conditionId: string | undefined, conditionName: string, timestamp: number) {
  const medicationName = input.medicationName.trim();
  const medicationId = input.medicationId ?? `local-medication-${timestamp}`;
  const rawTimes = input.localTimes?.length ? input.localTimes : [input.localTime || "08:00"];
  const requestedTimes = rawTimes.map(normalizeLocalTime).filter((time, index, values) => values.indexOf(time) === index);
  const existingMedicationSchedules = current.filter((schedule) => schedule.medicationId === medicationId);
  const untouchedSchedules = current.filter((schedule) => schedule.medicationId !== medicationId);
  const reconciledSchedules: CareMedicationSchedule[] = [];

  for (const [index, localTime] of requestedTimes.entries()) {
    const scheduleId = input.scheduleIds?.[index];
    const existing = existingMedicationSchedules.find((schedule) => schedule.id === scheduleId)
      ?? existingMedicationSchedules.find((schedule) => schedule.localTime === localTime);
    reconciledSchedules.push({
      id: existing?.id ?? scheduleId ?? `local-schedule-${timestamp}-${index}`,
      medicationId,
      medicationName,
      dosageLabel: input.dosageLabel.trim() || "-",
      conditionId,
      conditionName: conditionName || undefined,
      localTime,
      startsOn: input.startsOn || existing?.startsOn || getLocalDateKey(),
      endsOn: input.endsOn || undefined,
      recurrenceIntervalDays: normalizeRecurrenceInterval(input.recurrenceIntervalDays),
    });
  }

  return [...reconciledSchedules, ...untouchedSchedules];
}

function normalizeRecurrenceInterval(value: number | undefined) {
  if (!Number.isFinite(value) || !value) return 1;
  return Math.max(1, Math.floor(value));
}

function normalizeLocalTime(value: string) {
  const [rawHour, rawMinute] = value.split(":");
  const hour = Number(rawHour?.trim());
  const minute = Number(rawMinute?.trim() || "0");
  if (!rawHour?.trim() || !Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return "08:00:00";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}
