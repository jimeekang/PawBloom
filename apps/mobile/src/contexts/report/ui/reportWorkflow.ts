import type { GeneratedVetReport } from "../application/vetReportContract";

export type ReportWorkflowAction = "generate" | "confirm" | "share";
export type ReportWorkflowError = "accountRequired" | "petRequired" | "empty" | "generate" | "confirm" | "share";

export function getReportPrimaryAction({
  report,
  hasRecords,
  canGenerate,
  isBusy,
}: {
  report: GeneratedVetReport | null;
  hasRecords: boolean;
  canGenerate: boolean;
  isBusy: boolean;
}): ReportWorkflowAction | null {
  if (isBusy) return null;
  if (!report) return hasRecords && canGenerate ? "generate" : null;
  return report.status === "draft" ? "confirm" : "share";
}

export function formatReportExpiry(expiresAt: string) {
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return expiresAt;
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
