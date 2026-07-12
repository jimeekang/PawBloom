import type { UUID } from "../../../shared-kernel/types";

export type CareDoseStatus = "pending" | "completed" | "skipped" | "partial";

export type CareConditionStatus = "active" | "resolved" | "archived";

export type ActiveCareCondition = {
  id: UUID;
  name: string;
  status: CareConditionStatus;
  startsOn?: string;
  endsOn?: string;
};

export type ActiveCarePlanSummary = {
  id: UUID;
  conditionId?: UUID;
  title: string;
  instructions?: string;
  startsOn?: string;
  endsOn?: string;
};

export type CareMedicationSchedule = {
  id: UUID;
  medicationId: UUID;
  medicationName: string;
  dosageLabel: string;
  conditionId?: UUID;
  conditionName?: string;
  localTime: string;
  startsOn: string;
  endsOn?: string;
  recurrenceIntervalDays: number;
};

export type ActiveCareSetup = {
  conditions: ActiveCareCondition[];
  plans: ActiveCarePlanSummary[];
  condition?: ActiveCareCondition;
  plan?: ActiveCarePlanSummary;
  conditionName?: string;
  planTitle?: string;
  instructions?: string;
  schedules: CareMedicationSchedule[];
};

export type CareSetupInput = {
  clientMutationId?: UUID;
  conditionId?: UUID;
  planId?: UUID;
  medicationId?: UUID;
  scheduleIds?: UUID[];
  conditionName: string;
  planTitle: string;
  medicationName: string;
  dosageLabel: string;
  localTime?: string;
  localTimes?: string[];
  startsOn?: string;
  endsOn?: string;
  recurrenceIntervalDays?: number;
  instructions?: string;
};
