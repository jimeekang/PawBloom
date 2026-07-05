import type { DoseStatus } from "./medication";

export type MedicationSchedule = {
  id: string;
  medicationId: string;
  medicationName: string;
  dosageLabel: string;
  conditionId?: string;
  conditionName?: string;
  localTime: string;
  startsOn: string;
  endsOn?: string;
  recurrenceIntervalDays: number;
};

export type MedicationScheduleInput = {
  petId: string;
  userId: string;
  medicationId: string;
  localTime?: string;
  localTimes?: string[];
  startsOn?: string;
  endsOn?: string;
  recurrenceIntervalDays?: number;
};

export type ScheduledMedicationDoseStatus = Extract<DoseStatus, "completed" | "skipped" | "partial">;
