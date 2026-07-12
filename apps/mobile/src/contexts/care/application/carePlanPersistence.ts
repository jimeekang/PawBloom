import { supabase } from "../../../shared-kernel/supabase/client";
import { createClientMutationId } from "../../sync/application/offlineMutationPayload";
import { normalizeMedicationLocalTime } from "../../medication/application/medicationScheduleRecords";
import type { ActiveCareSetup, CareConditionStatus, CareSetupInput } from "../domain/carePlan";

export type CareSetupRpcRequest = {
  version: 1;
  clientMutationId: string;
  condition: { id: string | null; name: string };
  plan: { id: string | null; title: string; instructions: string | null };
  medication: { id: string | null; name: string; dosageLabel: string };
  schedules: Array<{ id: string | null; localTime: string }>;
  startsOn: string;
  endsOn: string | null;
  recurrenceIntervalDays: number;
};

export async function saveCareSetupRecords(petId: string, input: CareSetupInput): Promise<ActiveCareSetup> {
  if (!supabase) throw new Error("로그인이 필요합니다.");
  const { data, error } = await supabase.rpc("save_care_setup_v1", buildCareSetupRpcArgs(petId, input));
  if (error) throw new Error(error.message);
  return parseCareSetupRpcResult(data);
}

export function buildCareSetupRpcArgs(petId: string, input: CareSetupInput, clientMutationId = input.clientMutationId ?? createClientMutationId()) {
  return {
    p_pet_id: petId,
    p_request: {
      version: 1,
      clientMutationId,
      condition: { id: cleanOptional(input.conditionId) ?? null, name: input.conditionName.trim() },
      plan: { id: cleanOptional(input.planId) ?? null, title: input.planTitle.trim(), instructions: cleanOptional(input.instructions) ?? null },
      medication: { id: cleanOptional(input.medicationId) ?? null, name: input.medicationName.trim(), dosageLabel: input.dosageLabel.trim() },
      schedules: buildCareScheduleRequests(input).map((schedule) => ({ id: schedule.id ?? null, localTime: schedule.localTime })),
      startsOn: input.startsOn || currentDateKey(),
      endsOn: cleanOptional(input.endsOn) ?? null,
      recurrenceIntervalDays: normalizeRecurrenceInterval(input.recurrenceIntervalDays),
    } satisfies CareSetupRpcRequest,
  };
}

export function buildCareScheduleRequests(input: Pick<CareSetupInput, "localTime" | "localTimes" | "scheduleIds">) {
  const rawTimes = input.localTimes?.length ? input.localTimes : [input.localTime || "08:00"];
  const requests: { id?: string; localTime: string }[] = [];
  for (const [index, rawTime] of rawTimes.entries()) {
    const localTime = normalizeMedicationLocalTime(rawTime);
    if (!requests.some((request) => request.localTime === localTime)) requests.push({ id: cleanOptional(input.scheduleIds?.[index]), localTime });
  }
  return requests;
}

export function parseCareSetupRpcResult(value: unknown): ActiveCareSetup {
  const result = asRecord(value, "care setup result");
  const conditions = asArray(result.conditions, "conditions").map((item) => {
    const row = asRecord(item, "condition");
    return {
      id: requiredString(row.id, "condition id"),
      name: requiredString(row.name, "condition name"),
      status: careConditionStatus(row.status),
      startsOn: optionalString(row.startsOn),
      endsOn: optionalString(row.endsOn),
    };
  });
  const primaryConditionId = result.condition == null ? undefined : requiredString(asRecord(result.condition, "primary condition").id, "primary condition id");
  const condition = primaryConditionId ? conditions.find((item) => item.id === primaryConditionId) : undefined;
  if (primaryConditionId && !condition) throw new Error("Invalid primary condition.");
  const planRow = result.plan == null ? undefined : asRecord(result.plan, "care plan");
  const plan = planRow ? parseCarePlan(planRow) : undefined;
  const plans = result.plans == null
    ? (plan ? [plan] : [])
    : asArray(result.plans, "care plans").map((item) => parseCarePlan(asRecord(item, "care plan")));
  if (plan && !plans.some((item) => item.id === plan.id)) throw new Error("Invalid primary care plan.");
  const schedules = asArray(result.schedules, "schedules").map((item) => {
    const row = asRecord(item, "schedule");
    return {
      id: requiredString(row.id, "schedule id"),
      medicationId: requiredString(row.medicationId, "medication id"),
      medicationName: requiredString(row.medicationName, "medication name"),
      dosageLabel: requiredString(row.dosageLabel, "dosage label"),
      conditionId: optionalString(row.conditionId),
      conditionName: optionalString(row.conditionName),
      localTime: requiredString(row.localTime, "schedule local time"),
      startsOn: requiredString(row.startsOn, "schedule start date"),
      endsOn: optionalString(row.endsOn),
      recurrenceIntervalDays: positiveInteger(row.recurrenceIntervalDays),
    };
  });
  return { conditions, plans, condition, plan, conditionName: condition?.name, planTitle: plan?.title, instructions: plan?.instructions, schedules };
}

function parseCarePlan(row: Record<string, unknown>) {
  return {
    id: requiredString(row.id, "plan id"),
    conditionId: optionalString(row.conditionId),
    title: requiredString(row.title, "plan title"),
    instructions: optionalString(row.instructions),
    startsOn: optionalString(row.startsOn),
    endsOn: optionalString(row.endsOn),
  };
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  throw new Error(`Invalid ${label}.`);
}

function asArray(value: unknown, label: string) {
  if (Array.isArray(value)) return value;
  throw new Error(`Invalid ${label}.`);
}

function requiredString(value: unknown, label: string) {
  if (typeof value === "string" && value.length > 0) return value;
  throw new Error(`Invalid ${label}.`);
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function cleanOptional(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function positiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 1;
}

function careConditionStatus(value: unknown): CareConditionStatus {
  return value === "resolved" || value === "archived" ? value : "active";
}

function normalizeRecurrenceInterval(value: number | undefined) {
  if (!Number.isFinite(value) || !value) return 1;
  return Math.max(1, Math.floor(value));
}

function currentDateKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
