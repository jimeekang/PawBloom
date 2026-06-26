import type { UUID } from "../../../shared-kernel/types";

export type AiBrief = {
  id: UUID;
  petId: UUID;
  rangeDays: 3 | 7 | 14;
  highlights: string[];
  questionsForVet: string[];
  disclaimer: string;
};

export function hasRequiredDisclaimer(brief: AiBrief) {
  return brief.disclaimer.includes("record-based summary") && brief.disclaimer.includes("not a diagnosis");
}

