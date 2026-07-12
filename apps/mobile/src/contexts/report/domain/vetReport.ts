import type { UUID } from "../../../shared-kernel/types";

export type VetReportStatus = "draft" | "confirmed" | "shared";
export type VetReportRangeDays = 3 | 7 | 14;

export type VetReport = {
  id: UUID;
  petId: UUID;
  rangeDays: VetReportRangeDays;
  status: VetReportStatus;
  englishSummary: string;
  confirmedByOwner: boolean;
  disclaimer: string;
};

export function canShareReport(report: VetReport) {
  return report.confirmedByOwner && report.status !== "draft";
}
