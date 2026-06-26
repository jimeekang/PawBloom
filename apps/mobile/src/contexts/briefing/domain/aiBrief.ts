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
  const normalized = brief.disclaimer.trim();
  return (
    (normalized.includes("record-based summary") && normalized.includes("not a diagnosis")) ||
    (normalized.includes("기록 기반 요약") && (normalized.includes("진단이") || normalized.includes("진단")) && normalized.includes("의학적 판단"))
  );
}
