import { getLocalDateKey } from "../../../shared-kernel/date";
import type { ActiveCareSetup, CareMedicationSchedule, CareSetupInput } from "../domain/carePlan";

export function buildNextLocalCareSetup(current: ActiveCareSetup, input: CareSetupInput, timestamp = Date.now()): ActiveCareSetup {
  const condition = input.conditionName ? { id: `local-condition-${timestamp}`, name: input.conditionName, status: "active" as const } : undefined;
  const schedule: CareMedicationSchedule | null = input.medicationName.trim()
    ? { id: `local-schedule-${timestamp}`, medicationId: `local-medication-${timestamp}`, medicationName: input.medicationName.trim(), dosageLabel: input.dosageLabel || "-", conditionId: condition?.id, conditionName: input.conditionName, localTime: `${input.localTime || "08:00"}:00`, startsOn: input.startsOn || getLocalDateKey(), endsOn: input.endsOn || undefined, recurrenceIntervalDays: input.recurrenceIntervalDays ?? 1 }
    : null;

  return {
    conditions: condition ? [condition, ...current.conditions] : current.conditions,
    conditionName: input.conditionName,
    planTitle: input.planTitle,
    schedules: schedule ? [schedule, ...current.schedules] : current.schedules,
  };
}
