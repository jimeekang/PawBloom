import type { DoseRecord, DoseStatus } from "../../contexts/medication/domain/medication";

export type CareSummaryDoseRow = {
  id: string;
  title: string;
  statusLabel: string;
  timeLabel: string;
  details: string[];
};

const statusLabels: Record<DoseStatus, string> = {
  pending: "아직 투약 전",
  completed: "정량 투약 완료",
  partial: "일부만 투약",
  skipped: "오늘은 건너뜀",
};

export function createCareSummaryDoseRows(doses: DoseRecord[]): CareSummaryDoseRow[] {
  return doses.map((dose) => ({
    id: dose.id,
    title: dose.medicationName,
    statusLabel: statusLabels[dose.status],
    timeLabel: dose.scheduledAt,
    details: [
      formatDetail("병명/상태", dose.conditionName),
      formatDetail("처방 용량", dose.dosageLabel),
      formatDetail("오늘 투약", dose.administeredAmount),
      formatDetail("메모", dose.reactionNote),
    ].filter((detail): detail is string => Boolean(detail)),
  }));
}

function formatDetail(label: string, value?: string) {
  const trimmed = value?.trim();
  return trimmed ? `${label}: ${trimmed}` : null;
}
