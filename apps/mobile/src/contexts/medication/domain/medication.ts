import type { UUID } from "../../../shared-kernel/types";

export type DoseStatus = "pending" | "completed" | "skipped" | "partial";

export type DoseRecord = {
  id: UUID;
  petId: UUID;
  medicationName: string;
  scheduledAt: string;
  status: DoseStatus;
  recordedAt?: string;
  reactionNote?: string;
};

export function isDoseActionable(dose: DoseRecord) {
  return dose.status === "pending" || dose.status === "partial";
}

