import type { UUID } from "../../../shared-kernel/types";

export type OfflineMutation = {
  id: UUID;
  clientMutationId: UUID;
  aggregate: "diary" | "medication" | "care" | "report";
  operation: "insert" | "update" | "delete";
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
};

