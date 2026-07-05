import type { DoseStatus } from "../../medication/domain/medication";
import type { OfflineMutation } from "../domain/offlineMutation";

export type OfflineReplayStatus = "applied" | "retry" | "conflict" | "unsupported";
export type MedicationDoseReplayDecision = "apply" | "already_applied" | "conflict" | "missing";

export type OfflineReplayResult = {
  status: OfflineReplayStatus;
  reason: string;
};

export type ReplayDiaryEntryInput = {
  petId: string;
  userId: string;
  input: Record<string, unknown>;
  clientMutationId: string;
};

export type ReplayMedicationDoseInput = {
  petId: string;
  input: { id: string; status?: DoseStatus; [key: string]: unknown };
  clientMutationId: string;
};

export type OfflineReplayHandlers = {
  insertDiaryEntry: (input: ReplayDiaryEntryInput) => Promise<void>;
  getMedicationDose: (input: { petId: string; id: string }) => Promise<{ id: string; status: DoseStatus } | null>;
  updateMedicationDose: (input: ReplayMedicationDoseInput) => Promise<void>;
};

export async function replayOfflineMutation(mutation: OfflineMutation, handlers: OfflineReplayHandlers): Promise<OfflineReplayResult> {
  if (mutation.aggregate === "diary" && mutation.operation === "insert") {
    const payload = toRecord(mutation.payload);
    await handlers.insertDiaryEntry({
      petId: requireString(payload.petId, "diary replay pet id"),
      userId: requireString(payload.userId, "diary replay user id"),
      input: toRecord(payload.input),
      clientMutationId: mutation.clientMutationId,
    });
    return { status: "applied", reason: "diary insert replayed" };
  }

  if (mutation.aggregate === "medication" && mutation.operation === "update") {
    const payload = toRecord(mutation.payload);
    const petId = requireString(payload.petId, "medication replay pet id");
    const input = toMedicationDoseInput(payload.input);
    const serverDose = await handlers.getMedicationDose({ petId, id: input.id });
    const decision = resolveMedicationDoseReplayDecision({ serverStatus: serverDose?.status ?? null, localStatus: input.status });
    if (decision === "missing") return { status: "conflict", reason: "medication dose is no longer available" };
    if (decision === "already_applied") return { status: "applied", reason: "medication dose already has the offline status" };
    if (decision === "conflict") return { status: "conflict", reason: "medication dose was already changed on another device" };
    await handlers.updateMedicationDose({ petId, input, clientMutationId: mutation.clientMutationId });
    return { status: "applied", reason: "medication dose update replayed" };
  }

  return { status: "unsupported", reason: `${mutation.aggregate}.${mutation.operation} replay is not supported yet` };
}

export function resolveMedicationDoseReplayDecision(input: { serverStatus: DoseStatus | null; localStatus?: DoseStatus }): MedicationDoseReplayDecision {
  if (!input.serverStatus) return "missing";
  if (!input.localStatus || input.serverStatus === input.localStatus) return "already_applied";
  if (input.serverStatus === "pending") return "apply";
  return "conflict";
}

function toMedicationDoseInput(value: unknown): ReplayMedicationDoseInput["input"] {
  const input = toRecord(value);
  return { ...input, id: requireString(input.id, "medication replay dose id"), status: normalizeDoseStatus(input.status) };
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function requireString(value: unknown, label: string) {
  if (typeof value === "string" && value.length > 0) return value;
  throw new Error(`Missing ${label}.`);
}

function normalizeDoseStatus(value: unknown): DoseStatus | undefined {
  return value === "pending" || value === "completed" || value === "skipped" || value === "partial" ? value : undefined;
}
