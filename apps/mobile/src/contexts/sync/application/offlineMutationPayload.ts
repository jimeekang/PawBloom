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
  return globalThis.crypto?.randomUUID?.() ?? createFallbackUuidV4();
}

function createFallbackUuidV4() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (value) => (
    Number(value) ^ Math.floor(Math.random() * 16) >> Number(value) / 4
  ).toString(16));
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
