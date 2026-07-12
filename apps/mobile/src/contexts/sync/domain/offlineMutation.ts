import type { UUID } from "../../../shared-kernel/types";

export type OfflineMutation = {
  id: UUID;
  clientMutationId: UUID;
  aggregate: string;
  operation: "insert" | "update" | "delete";
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  /** Store-owned replay lease. Callers must not set or persist this value. */
  queuedByUserId?: string;
};
