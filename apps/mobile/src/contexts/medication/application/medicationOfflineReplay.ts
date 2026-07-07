import { buildOfflineMutation, requireString, stringValue, toRecord, type BaseOfflineMutationInput } from "../../sync/application/offlineMutationPayload";
import { registerOfflineReplayHandler, type OfflineReplayResult } from "../../sync/application/offlineReplayPolicy";
import type { OfflineMutation } from "../../sync/domain/offlineMutation";
import type { DoseStatus } from "../domain/medication";
import { buildDoseRecordedAt, encodeMedicationDoseCareNote } from "./medicationDosePayload";

export type MedicationDoseReplayDecision = "apply" | "already_applied" | "conflict" | "missing";

type ReplayMedicationDoseInput = { id: string; status?: DoseStatus; [key: string]: unknown };

export function buildMedicationDoseUpdateOfflineMutation(input: BaseOfflineMutationInput & { petId: string; input: Record<string, unknown> }): OfflineMutation {
  return buildOfflineMutation({
    aggregate: "medication",
    operation: "update",
    payload: { petId: input.petId, input: input.input },
    clientMutationId: input.clientMutationId,
    createdAt: input.createdAt,
  });
}

export function buildMedicationDoseReplayUpdatePayload(input: { clientMutationId: string; input: Record<string, unknown> }) {
  const status = normalizeDoseStatus(input.input.status);
  return {
    medication_name: stringValue(input.input.medicationName)?.trim() || "투약",
    reaction_note: encodeMedicationDoseCareNote(input.input),
    status,
    recorded_at: status ? buildDoseRecordedAt(status) : undefined,
    client_mutation_id: input.clientMutationId,
    updated_at: new Date().toISOString(),
  };
}

export function resolveMedicationDoseReplayDecision(input: { serverStatus: DoseStatus | null; localStatus?: DoseStatus }): MedicationDoseReplayDecision {
  if (!input.serverStatus) return "missing";
  if (!input.localStatus || input.serverStatus === input.localStatus) return "already_applied";
  if (input.serverStatus === "pending") return "apply";
  return "conflict";
}

async function replayMedicationDoseUpdate(mutation: OfflineMutation): Promise<OfflineReplayResult> {
  const { supabase } = await import("../../../shared-kernel/supabase/client");
  if (!supabase) throw new Error("Supabase client is not configured.");
  const payload = toRecord(mutation.payload);
  const petId = requireString(payload.petId, "medication replay pet id");
  const input = toMedicationDoseInput(payload.input);

  const { data: serverDose, error: fetchError } = await supabase
    .from("medication_doses")
    .select("id,status")
    .eq("id", input.id)
    .eq("pet_id", petId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);

  const decision = resolveMedicationDoseReplayDecision({ serverStatus: serverDose ? normalizeDoseStatus(serverDose.status) ?? null : null, localStatus: input.status });
  if (decision === "missing") return { status: "conflict", reason: "medication dose is no longer available" };
  if (decision === "already_applied") return { status: "applied", reason: "medication dose already has the offline status" };
  if (decision === "conflict") return { status: "conflict", reason: "medication dose was already changed on another device" };

  const { error: updateError } = await supabase
    .from("medication_doses")
    .update(buildMedicationDoseReplayUpdatePayload({ clientMutationId: mutation.clientMutationId, input }))
    .eq("id", input.id)
    .eq("pet_id", petId)
    .select("id")
    .single();
  if (updateError) throw new Error(updateError.message);
  return { status: "applied", reason: "medication dose update replayed" };
}

registerOfflineReplayHandler("medication", "update", replayMedicationDoseUpdate);

function toMedicationDoseInput(value: unknown): ReplayMedicationDoseInput {
  const input = toRecord(value);
  return { ...input, id: requireString(input.id, "medication replay dose id"), status: normalizeDoseStatus(input.status) };
}

function normalizeDoseStatus(value: unknown): DoseStatus | undefined {
  return value === "pending" || value === "completed" || value === "skipped" || value === "partial" ? value : undefined;
}
