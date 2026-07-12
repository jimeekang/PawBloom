import { buildOfflineMutation, requireString, stringValue, toRecord, type BaseOfflineMutationInput } from "../../sync/application/offlineMutationPayload";
import { registerOfflineReplayHandler, type OfflineReplayResult } from "../../sync/application/offlineReplayPolicy";
import type { OfflineMutation } from "../../sync/domain/offlineMutation";
import type { Database } from "../../../shared-kernel/supabase/database.types";
import type { DoseStatus } from "../domain/medication";
import { buildDoseRecordedAt, buildMedicationDoseInsertPayload, encodeMedicationDoseCareNote, type MedicationDoseInsertPayload } from "./medicationDosePayload";

export type MedicationDoseReplayDecision = "apply" | "already_applied" | "conflict" | "missing";

type ReplayMedicationDoseInput = { id: string; status?: DoseStatus; [key: string]: unknown };
type MedicationDoseUpdate = Database["public"]["Tables"]["medication_doses"]["Update"];

export function buildMedicationDoseInsertOfflineMutation(input: BaseOfflineMutationInput & { petId: string; userId: string; input: Record<string, unknown>; insertPayload?: MedicationDoseInsertPayload }): OfflineMutation {
  return buildOfflineMutation({
    aggregate: "medication",
    operation: "insert",
    payload: { petId: input.petId, userId: input.userId, input: input.input, insertPayload: input.insertPayload },
    clientMutationId: input.clientMutationId,
    createdAt: input.createdAt,
  });
}

export function buildMedicationDoseUpdateOfflineMutation(input: BaseOfflineMutationInput & { petId: string; input: Record<string, unknown>; updatePayload?: Record<string, unknown> }): OfflineMutation {
  return buildOfflineMutation({
    aggregate: "medication",
    operation: "update",
    payload: { petId: input.petId, input: input.input, updatePayload: input.updatePayload },
    clientMutationId: input.clientMutationId,
    createdAt: input.createdAt,
  });
}

export function buildMedicationDoseReplayUpdatePayload(input: { clientMutationId: string; input: Record<string, unknown>; storedPayload?: Record<string, unknown> }): MedicationDoseUpdate {
  const storedPayload = toRecord(input.storedPayload);
  if (stringValue(storedPayload.medication_name)) {
    const storedUpdate: MedicationDoseUpdate = {
      medication_name: stringValue(storedPayload.medication_name),
      client_mutation_id: input.clientMutationId,
      updated_at: stringValue(storedPayload.updated_at) ?? new Date().toISOString(),
    };
    if (storedPayload.reaction_note === null || typeof storedPayload.reaction_note === "string") storedUpdate.reaction_note = storedPayload.reaction_note;
    if (typeof storedPayload.scheduled_at === "string") storedUpdate.scheduled_at = storedPayload.scheduled_at;
    const storedStatus = normalizeDoseStatus(storedPayload.status);
    if (storedStatus) storedUpdate.status = storedStatus;
    if (storedPayload.recorded_at === null || typeof storedPayload.recorded_at === "string") storedUpdate.recorded_at = storedPayload.recorded_at;
    return storedUpdate;
  }
  const status = normalizeDoseStatus(input.input.status);
  const payload: MedicationDoseUpdate = {
    medication_name: stringValue(input.input.medicationName)?.trim() || "투약",
    reaction_note: encodeMedicationDoseCareNote(input.input),
    client_mutation_id: input.clientMutationId,
    updated_at: new Date().toISOString(),
  };
  if (status) {
    payload.status = status;
    payload.recorded_at = buildDoseRecordedAt(status);
  }
  const scheduledAt = buildScheduledAtForTime(stringValue(input.input.scheduledTime));
  if (scheduledAt) payload.scheduled_at = scheduledAt;
  return payload;
}

export function buildMedicationDoseReplayInsertPayload(input: { petId: string; userId: string; clientMutationId: string; input: Record<string, unknown>; insertPayload?: Record<string, unknown> }) {
  const storedPayload = toRecord(input.insertPayload);
  if (stringValue(storedPayload.dose_date) && stringValue(storedPayload.scheduled_at)) {
    return {
      pet_id: input.petId,
      created_by: input.userId,
      schedule_id: stringValue(storedPayload.schedule_id) ?? null,
      dose_date: requireString(storedPayload.dose_date, "stored medication dose date"),
      medication_name: stringValue(storedPayload.medication_name)?.trim() || "투약",
      scheduled_at: requireString(storedPayload.scheduled_at, "stored medication scheduled time"),
      status: normalizeDoseStatus(storedPayload.status) ?? "pending",
      recorded_at: storedPayload.recorded_at === null ? null : stringValue(storedPayload.recorded_at) ?? null,
      reaction_note: storedPayload.reaction_note === null ? null : stringValue(storedPayload.reaction_note) ?? null,
      client_mutation_id: input.clientMutationId,
    } satisfies MedicationDoseInsertPayload;
  }
  return buildMedicationDoseInsertPayload({
    ...input.input,
    petId: input.petId,
    userId: input.userId,
    clientMutationId: input.clientMutationId,
    scheduleId: stringValue(input.input.scheduleId),
    doseDate: stringValue(input.input.doseDate),
    scheduledTime: stringValue(input.input.scheduledTime),
    medicationName: stringValue(input.input.medicationName) ?? "투약",
    conditionName: stringValue(input.input.conditionName),
    dosageLabel: stringValue(input.input.dosageLabel),
    administeredAmount: stringValue(input.input.administeredAmount),
    reactionNote: stringValue(input.input.reactionNote),
    status: normalizeDoseStatus(input.input.status),
  });
}

export function resolveMedicationDoseReplayDecision(input: { serverStatus: DoseStatus | null; localStatus?: DoseStatus; serverClientMutationId?: string | null; clientMutationId?: string; hasFieldChanges?: boolean }): MedicationDoseReplayDecision {
  if (!input.serverStatus) return "missing";
  if (input.clientMutationId && input.serverClientMutationId === input.clientMutationId) return "already_applied";
  if (!input.localStatus || input.serverStatus === input.localStatus) return input.hasFieldChanges ? "apply" : "already_applied";
  if (input.serverStatus === "pending") return "apply";
  return "conflict";
}

async function replayMedicationDoseInsert(mutation: OfflineMutation): Promise<OfflineReplayResult> {
  const { supabase } = await import("../../../shared-kernel/supabase/client");
  if (!supabase) throw new Error("Supabase client is not configured.");
  const payload = toRecord(mutation.payload);
  const petId = requireString(payload.petId, "medication replay pet id");
  const insertPayload = buildMedicationDoseReplayInsertPayload({
    petId,
    userId: requireString(payload.userId, "medication replay user id"),
    input: toRecord(payload.input),
    insertPayload: toRecord(payload.insertPayload),
    clientMutationId: mutation.clientMutationId,
  });

  if (insertPayload.schedule_id) {
    const { data: existingDose, error: fetchError } = await supabase
      .from("medication_doses")
      .select("id,status,client_mutation_id")
      .eq("pet_id", petId)
      .eq("schedule_id", insertPayload.schedule_id)
      .eq("dose_date", insertPayload.dose_date)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);
    if (existingDose) {
      const decision = resolveMedicationDoseReplayDecision({ serverStatus: normalizeDoseStatus(existingDose.status) ?? null, localStatus: insertPayload.status, serverClientMutationId: existingDose.client_mutation_id, clientMutationId: mutation.clientMutationId });
      if (decision === "already_applied") return { status: "applied", reason: "medication dose already exists with the offline status" };
      if (decision === "conflict") return { status: "conflict", reason: "scheduled medication dose was already changed on another device" };
      const { error: updateError } = await supabase
        .from("medication_doses")
        .update(buildMedicationDoseReplayUpdatePayload({ clientMutationId: mutation.clientMutationId, input: { ...toRecord(payload.input), id: existingDose.id, status: insertPayload.status } }))
        .eq("id", existingDose.id)
        .eq("pet_id", petId)
        .select("id")
        .single();
      if (updateError) throw new Error(updateError.message);
      return { status: "applied", reason: "scheduled medication dose replayed onto existing pending dose" };
    }
  }

  const { error } = await supabase.from("medication_doses").insert(insertPayload).select("id").single();
  if (error) {
    if (error.code === "23505" && error.message.includes("client_mutation_id")) return { status: "applied", reason: "medication insert was already replayed" };
    if (error.code === "23505") return { status: "conflict", reason: "medication dose already exists for this schedule and date" };
    throw new Error(error.message);
  }
  return { status: "applied", reason: "medication dose insert replayed" };
}

async function replayMedicationDoseUpdate(mutation: OfflineMutation): Promise<OfflineReplayResult> {
  const { supabase } = await import("../../../shared-kernel/supabase/client");
  if (!supabase) throw new Error("Supabase client is not configured.");
  const payload = toRecord(mutation.payload);
  const petId = requireString(payload.petId, "medication replay pet id");
  const input = toMedicationDoseInput(payload.input);

  const { data: serverDose, error: fetchError } = await supabase
    .from("medication_doses")
    .select("id,status,client_mutation_id")
    .eq("id", input.id)
    .eq("pet_id", petId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);

  const decision = resolveMedicationDoseReplayDecision({ serverStatus: serverDose ? normalizeDoseStatus(serverDose.status) ?? null : null, localStatus: input.status, serverClientMutationId: serverDose?.client_mutation_id, clientMutationId: mutation.clientMutationId, hasFieldChanges: true });
  if (decision === "missing") return { status: "conflict", reason: "medication dose is no longer available" };
  if (decision === "already_applied") return { status: "applied", reason: "medication dose already has the offline status" };
  if (decision === "conflict") return { status: "conflict", reason: "medication dose was already changed on another device" };

  const { error: updateError } = await supabase
    .from("medication_doses")
    .update(buildMedicationDoseReplayUpdatePayload({ clientMutationId: mutation.clientMutationId, input, storedPayload: toRecord(payload.updatePayload) }))
    .eq("id", input.id)
    .eq("pet_id", petId)
    .select("id")
    .single();
  if (updateError) throw new Error(updateError.message);
  return { status: "applied", reason: "medication dose update replayed" };
}

registerOfflineReplayHandler("medication", "insert", replayMedicationDoseInsert);
registerOfflineReplayHandler("medication", "update", replayMedicationDoseUpdate);

function toMedicationDoseInput(value: unknown): ReplayMedicationDoseInput {
  const input = toRecord(value);
  return { ...input, id: requireString(input.id, "medication replay dose id"), status: normalizeDoseStatus(input.status) };
}

function normalizeDoseStatus(value: unknown): DoseStatus | undefined {
  return value === "pending" || value === "completed" || value === "skipped" || value === "partial" ? value : undefined;
}

function buildScheduledAtForTime(value?: string) {
  const match = value?.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}
