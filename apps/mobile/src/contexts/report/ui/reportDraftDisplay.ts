import { formatDateKeyDisplay } from "../../../shared-kernel/date";
import type { Language } from "../../../shared-kernel/types";
import { t, type TranslationKey } from "../../../i18n/translations";
import type { DoseStatus } from "../../medication/domain/medication";
import type { ReportMissingKind, ReportTimelineItem, ReportVetQuestionKind } from "../application/reportDraftRecords";

// Localizes the language-neutral report draft summary for display (0006 C3).
// The application layer stays i18n-free; every user-facing string lives here.

export function formatReportMissingRecord(kind: ReportMissingKind): string {
  return t("ko", `reports.missing.${kind}` as TranslationKey);
}

export function formatReportVetQuestion(kind: ReportVetQuestionKind): string {
  return t("ko", `reports.q.${kind}` as TranslationKey);
}

const doseStatusKeys: Record<DoseStatus, TranslationKey> = {
  pending: "care.status.pending",
  completed: "care.status.completed",
  partial: "care.status.partial",
  skipped: "care.status.skipped",
};

export function formatReportTimelineItem(item: ReportTimelineItem, language: Language): string {
  const datePart = item.dateKey ? `${formatDateKeyDisplay(item.dateKey, language)} ` : "";
  if (item.kind === "diary") {
    const score = item.conditionScore ? ` · ${t("ko", "reports.timelineScore")} ${item.conditionScore}/5` : "";
    return `${datePart}${item.time} · ${t("ko", `category.${item.category ?? "memo"}` as TranslationKey)}: ${item.summary ?? ""}${score}`;
  }
  const dosage = item.dosageLabel ? ` · ${t("ko", "care.dosageLabel")}: ${item.dosageLabel}` : "";
  const given = item.administeredAmount ? t("ko", "reports.timelineGiven").replace("{amount}", item.administeredAmount) : "";
  const reaction = item.reactionNote ? ` · ${t("ko", "care.reactionLabel")}: ${item.reactionNote}` : "";
  return `${datePart}${item.time} · ${t("ko", "reports.timelineMedication")} ${item.medicationName ?? ""}: ${t("ko", doseStatusKeys[item.status ?? "pending"])}${dosage}${given}${reaction}`;
}
