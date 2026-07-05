import type { Database } from "../../../shared-kernel/supabase/database.types";
import type { MedicationSchedule, MedicationScheduleInput, ScheduledMedicationDoseStatus } from "../domain/medicationSchedule";

type ConditionRow = Database["public"]["Tables"]["conditions"]["Row"];
type MedicationRow = Database["public"]["Tables"]["medications"]["Row"];
type ScheduleRow = Database["public"]["Tables"]["medication_schedules"]["Row"];
type ScheduleInsert = Database["public"]["Tables"]["medication_schedules"]["Insert"];

export function buildMedicationScheduleInsertRows(input: MedicationScheduleInput): ScheduleInsert[] {
  const localTimes = input.localTimes?.length ? input.localTimes : [input.localTime || "08:00"];
  return localTimes.map((localTime) => ({
    pet_id: input.petId,
    created_by: input.userId,
    medication_id: input.medicationId,
    local_time: normalizeMedicationLocalTime(localTime),
    starts_on: input.startsOn || currentDateKey(),
    ends_on: input.endsOn?.trim() || null,
    recurrence_interval_days: normalizeMedicationRecurrenceInterval(input.recurrenceIntervalDays),
  }));
}

export function mapMedicationSchedules(medications: MedicationRow[], schedules: ScheduleRow[], conditions: ConditionRow[] = []): MedicationSchedule[] {
  const medicationById = new Map(medications.map((medication) => [medication.id, medication]));
  const conditionById = new Map(conditions.map((condition) => [condition.id, condition]));
  return schedules.flatMap((schedule) => {
    const medication = medicationById.get(schedule.medication_id);
    if (!medication) return [];
    const condition = medication.condition_id ? conditionById.get(medication.condition_id) : undefined;
    return [{
      id: schedule.id,
      medicationId: medication.id,
      medicationName: medication.name,
      dosageLabel: medication.dosage_label,
      conditionId: medication.condition_id ?? undefined,
      conditionName: condition?.name,
      localTime: schedule.local_time,
      startsOn: schedule.starts_on,
      endsOn: schedule.ends_on ?? undefined,
      recurrenceIntervalDays: schedule.recurrence_interval_days ?? 1,
    }];
  });
}

export function buildScheduledMedicationDoseInput(schedule: MedicationSchedule, doseDate: string, status: ScheduledMedicationDoseStatus) {
  return {
    scheduleId: schedule.id,
    doseDate,
    scheduledTime: schedule.localTime.slice(0, 5),
    conditionName: schedule.conditionName,
    medicationName: schedule.medicationName,
    dosageLabel: schedule.dosageLabel,
    status,
  };
}

export function mapMedicationSchedulesForTest(medications: MedicationRow[], schedules: ScheduleRow[], conditions: ConditionRow[] = []) {
  return mapMedicationSchedules(medications, schedules, conditions);
}

export function normalizeMedicationLocalTime(value: string) {
  const [rawHour, rawMinute] = value.split(":");
  if (!rawHour?.trim()) return "08:00:00";
  const hour = Number(rawHour.trim());
  const minute = Number(rawMinute?.trim() || "0");
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return "08:00:00";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

function normalizeMedicationRecurrenceInterval(value: number | undefined) {
  if (!Number.isFinite(value) || !value) return 1;
  return Math.max(1, Math.floor(value));
}

function currentDateKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
