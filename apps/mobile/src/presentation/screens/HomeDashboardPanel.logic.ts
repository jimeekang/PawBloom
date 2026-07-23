import type { DoseRecord, DoseStatus } from "../../contexts/medication/domain/medication";
import type { TodayMedicationAgendaRow } from "../../contexts/medication/ui/todayMedicationAgenda";
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

type AgendaSummaryRow = Pick<TodayMedicationAgendaRow, "doseId" | "scheduleId" | "doseDate" | "medicationName" | "conditionName" | "dosageLabel" | "scheduledTime" | "status">;

// Card counts and rows share the agenda source the hero uses (0006 B8):
// schedule rows without a recorded dose appear as pending instead of the
// contradictory "0/0 · no records" state.
export function createCareSummaryAgendaCounts(doses: DoseRecord[], agenda: AgendaSummaryRow[]): { completedCount: number; totalCount: number } {
  const rows: { status: DoseStatus }[] = agenda.length > 0 ? agenda : doses;
  return {
    completedCount: rows.filter((row) => row.status !== "pending").length,
    totalCount: rows.length,
  };
}

export function createCareSummaryRows(doses: DoseRecord[], agenda: AgendaSummaryRow[]): CareSummaryDoseRow[] {
  const scheduledRows = agenda
    .filter((row) => !row.doseId)
    .map((row) => ({
      id: `schedule-${row.scheduleId ?? "none"}-${row.doseDate}-${row.scheduledTime}`,
      title: row.medicationName,
      statusLabel: t("ko", statusLabelKeys[row.status]),
      timeLabel: row.scheduledTime,
      details: [
        formatDetail(t("ko", "care.conditionLabel"), row.conditionName),
        formatDetail(t("ko", "care.dosageLabel"), row.dosageLabel),
      ].filter((detail): detail is string => Boolean(detail)),
    }));
  return [...scheduledRows, ...createCareSummaryDoseRows(doses)];
}
