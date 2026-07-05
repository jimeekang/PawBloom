import type { OfflineMutation } from "../domain/offlineMutation";

type BaseOfflineMutationInput = {
  clientMutationId?: string;
  createdAt?: string;
};

export function buildDiaryInsertOfflineMutation(input: BaseOfflineMutationInput & { petId: string; userId: string; input: Record<string, unknown> }): OfflineMutation {
  const clientMutationId = input.clientMutationId ?? createClientMutationId();
  return {
    id: `offline-${clientMutationId}`,
    clientMutationId,
    aggregate: "diary",
    operation: "insert",
    payload: { petId: input.petId, userId: input.userId, input: input.input },
    createdAt: input.createdAt ?? new Date().toISOString(),
    attempts: 0,
  };
}

export function buildMedicationDoseUpdateOfflineMutation(input: BaseOfflineMutationInput & { petId: string; input: Record<string, unknown> }): OfflineMutation {
  const clientMutationId = input.clientMutationId ?? createClientMutationId();
  return {
    id: `offline-${clientMutationId}`,
    clientMutationId,
    aggregate: "medication",
    operation: "update",
    payload: { petId: input.petId, input: input.input },
    createdAt: input.createdAt ?? new Date().toISOString(),
    attempts: 0,
  };
}

function createClientMutationId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
