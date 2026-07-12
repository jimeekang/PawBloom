import type { OfflineMutation } from "../domain/offlineMutation";

export function withoutQueuedOwner(mutation: OfflineMutation): OfflineMutation {
  const { queuedByUserId: _queuedByUserId, ...storedMutation } = mutation;
  return storedMutation;
}

export function parseStoredOfflineMutation(value: string): OfflineMutation | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return isOfflineMutation(parsed) ? withoutQueuedOwner(parsed) : null;
  } catch {
    return null;
  }
}

export function isOfflineMutation(value: unknown): value is OfflineMutation {
  if (!value || typeof value !== "object") return false;
  const mutation = value as Partial<OfflineMutation>;
  return typeof mutation.id === "string" && mutation.id.length > 0
    && typeof mutation.clientMutationId === "string" && mutation.clientMutationId.length > 0
    && typeof mutation.aggregate === "string" && mutation.aggregate.length > 0
    && (mutation.operation === "insert" || mutation.operation === "update" || mutation.operation === "delete")
    && Boolean(mutation.payload && typeof mutation.payload === "object" && !Array.isArray(mutation.payload))
    && typeof mutation.createdAt === "string" && Number.isInteger(mutation.attempts);
}

export function cloneOutboxValue<T>(value: T): T {
  try {
    if (typeof globalThis.structuredClone === "function") return globalThis.structuredClone(value);
  } catch {
    // JSON fallback supports the mutation contract's serializable values.
  }
  return JSON.parse(JSON.stringify(value)) as T;
}
