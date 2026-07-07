import type { OfflineMutation } from "../domain/offlineMutation";

export type BaseOfflineMutationInput = {
  clientMutationId?: string;
  createdAt?: string;
};

export function buildOfflineMutation(input: BaseOfflineMutationInput & { aggregate: string; operation: OfflineMutation["operation"]; payload: Record<string, unknown> }): OfflineMutation {
  const clientMutationId = input.clientMutationId ?? createClientMutationId();
  return {
    id: `offline-${clientMutationId}`,
    clientMutationId,
    aggregate: input.aggregate,
    operation: input.operation,
    payload: input.payload,
    createdAt: input.createdAt ?? new Date().toISOString(),
    attempts: 0,
  };
}

export function createClientMutationId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function requireString(value: unknown, label: string) {
  if (typeof value === "string" && value.length > 0) return value;
  throw new Error(`Missing ${label}.`);
}

export function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
