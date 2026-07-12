import type { GeneratedVetReport } from "../application/vetReportContract";

export type ReportWorkflowAction = "generate" | "confirm" | "share" | "revoke";
export type ReportWorkflowError = "accountRequired" | "petRequired" | "empty" | "permission" | "load" | "generate" | "confirm" | "share" | "revoke";

export function getReportPrimaryAction({
  report,
  hasRecords,
  canGenerate,
  canConfirm = true,
  canShare = true,
  isBusy,
}: {
  report: GeneratedVetReport | null;
  hasRecords: boolean;
  canGenerate: boolean;
  canConfirm?: boolean;
  canShare?: boolean;
  isBusy: boolean;
}): ReportWorkflowAction | null {
  if (isBusy) return null;
  if (!report) return hasRecords && canGenerate ? "generate" : null;
  if (report.status === "draft") return canConfirm ? "confirm" : null;
  return canShare ? "share" : null;
}

export function formatReportExpiry(expiresAt: string, locale = "ko-KR") {
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return expiresAt;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function hasUsableReportLink(report: GeneratedVetReport, now = Date.now()) {
  if (!report.shareUrl || !report.shareToken || !report.expiresAt) return false;
  const expiresAt = new Date(report.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now;
}
