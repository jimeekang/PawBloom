import { buildCareSetupRpcArgs, parseCareSetupRpcResult } from "./carePlanPersistence";

const args = buildCareSetupRpcArgs("pet-1", {
  conditionId: "condition-1",
  planId: "plan-1",
  medicationId: "medication-1",
  scheduleIds: ["schedule-1", "schedule-2", "duplicate"],
  conditionName: " 피부염 ",
  planTitle: " 2주 관리 ",
  medicationName: " 항생제 ",
  dosageLabel: " 반 정 ",
  localTimes: ["08:30", "20:30", "08:30"],
  startsOn: "2026-07-12",
  endsOn: "2026-07-20",
  recurrenceIntervalDays: 2,
}, "11111111-1111-4111-8111-111111111111");

const request = args.p_request;
if (args.p_pet_id !== "pet-1" || request.clientMutationId !== "11111111-1111-4111-8111-111111111111") {
  throw new Error("care setup RPC must scope and idempotently identify the save");
}
if (request.schedules.length !== 2 || request.schedules[0]?.id !== "schedule-1" || request.schedules[1]?.id !== "schedule-2") {
  throw new Error("care setup RPC must reconcile the exact requested schedule set");
}
if (request.condition.name !== "피부염" || request.medication.dosageLabel !== "반 정") {
  throw new Error("care setup RPC must normalize editable text before persistence");
}

const setup = parseCareSetupRpcResult({
  conditions: [{ id: "condition-1", name: "피부염", status: "active", startsOn: "2026-07-12", endsOn: null }],
  condition: { id: "condition-1" },
  plans: [{ id: "plan-1", conditionId: "condition-1", title: "2주 관리", instructions: null, startsOn: "2026-07-12", endsOn: "2026-07-20" }],
  plan: { id: "plan-1", conditionId: "condition-1", title: "2주 관리", instructions: null, startsOn: "2026-07-12", endsOn: "2026-07-20" },
  schedules: [{ id: "schedule-1", medicationId: "medication-1", medicationName: "항생제", dosageLabel: "반 정", conditionId: "condition-1", conditionName: "피부염", localTime: "08:30:00", startsOn: "2026-07-12", endsOn: null, recurrenceIntervalDays: 2 }],
});

if (setup.condition?.id !== "condition-1" || setup.plan?.id !== "plan-1" || setup.plans[0]?.conditionId !== "condition-1" || setup.schedules[0]?.id !== "schedule-1") {
  throw new Error("care setup RPC response must be the authoritative post-transaction snapshot");
}

let rejectedMalformedResult = false;
try {
  parseCareSetupRpcResult({ conditions: [], schedules: [{ id: "schedule-without-medication" }] });
} catch {
  rejectedMalformedResult = true;
}
if (!rejectedMalformedResult) throw new Error("care setup RPC must reject a partial response instead of reporting a false save success");

let rejectedMismatchedPrimary = false;
try {
  parseCareSetupRpcResult({ conditions: [], condition: { id: "missing-condition" }, plan: null, schedules: [] });
} catch {
  rejectedMismatchedPrimary = true;
}
if (!rejectedMismatchedPrimary) throw new Error("care setup RPC must reject a primary condition missing from its authoritative condition list");
