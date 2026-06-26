import type { UUID } from "../../../shared-kernel/types";

export type VetReportStatus = "draft" | "confirmed" | "shared";

export type VetReport = {
  id: UUID;
  petId: UUID;
  rangeDays: 3 | 7 | 14;
  status: VetReportStatus;
  englishSummary: string;
  confirmedByOwner: boolean;
  disclaimer: string;
};

export function canShareReport(report: VetReport) {
  return report.confirmedByOwner && report.status !== "draft";
}

