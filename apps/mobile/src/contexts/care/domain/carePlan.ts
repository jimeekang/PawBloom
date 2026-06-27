import type { UUID } from "../../../shared-kernel/types";

export type CareDoseStatus = "pending" | "completed" | "skipped" | "partial";

export type CareMedicationSchedule = {
  id: UUID;
  medicationId: UUID;
  medicationName: string;
  dosageLabel: string;
  conditionName?: string;
  localTime: string;
};

export type ActiveCareSetup = {
  conditionName?: string;
  planTitle?: string;
  instructions?: string;
  schedules: CareMedicationSchedule[];
};

export type CareSetupInput = {
  conditionName: string;
  planTitle: string;
  medicationName: string;
  dosageLabel: string;
  localTime: string;
  instructions?: string;
};
