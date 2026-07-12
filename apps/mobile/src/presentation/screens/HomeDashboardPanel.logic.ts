import type { DoseRecord, DoseStatus } from "../../contexts/medication/domain/medication";
import { t, type TranslationKey } from "../../i18n/translations";

export type CareSummaryDoseRow = {
  id: string;
  title: string;
  statusLabel: string;
  timeLabel: string;
  details: string[];
};

const statusLabelKeys: Record<DoseStatus, TranslationKey> = {
  pending: "care.status.pending",
  completed: "care.status.completed",
  partial: "care.status.partial",
  skipped: "care.status.skipped",
};

export function createCareSummaryDoseRows(doses: DoseRecord[]): CareSummaryDoseRow[] {
  return doses.map((dose) => ({
    id: dose.id,
    title: dose.medicationName,
    statusLabel: t("ko", statusLabelKeys[dose.status]),
    timeLabel: dose.scheduledAt,
    details: [
      formatDetail(t("ko", "care.conditionLabel"), dose.conditionName),
      formatDetail(t("ko", "care.dosageLabel"), dose.dosageLabel),
      formatDetail(t("ko", "care.administeredLabel"), dose.administeredAmount),
      formatDetail(t("ko", "care.reactionLabel"), dose.reactionNote),
    ].filter((detail): detail is string => Boolean(detail)),
  }));
}

function formatDetail(label: string, value?: string) {
  const trimmed = value?.trim();
  return trimmed ? `${label}: ${trimmed}` : null;
}
