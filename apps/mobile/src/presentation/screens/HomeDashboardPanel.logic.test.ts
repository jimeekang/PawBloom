import { createCareSummaryDoseRows } from "./HomeDashboardPanel.logic";

const rows = createCareSummaryDoseRows([
  {
    id: "dose-1",
    petId: "pet-1",
    medicationName: "Amoxi",
    conditionName: "Cough",
    dosageLabel: "1 tablet",
    administeredAmount: "1/2 tablet",
    scheduledAt: "08:30",
    status: "partial",
    reactionNote: "Ate after dose",
  },
]);

if (rows[0]?.title !== "Amoxi" || rows[0]?.statusLabel !== "일부만 투약" || rows[0]?.timeLabel !== "08:30") {
  throw new Error("care summary rows must expose saved medication title, status, and time");
}

if (!rows[0]?.details.includes("병명/상태: Cough") || !rows[0]?.details.includes("처방 용량: 1 tablet") || !rows[0]?.details.includes("오늘 투약: 1/2 tablet") || !rows[0]?.details.includes("메모: Ate after dose")) {
  throw new Error("care summary rows must expose saved care details");
}

if (createCareSummaryDoseRows([]).length !== 0) {
  throw new Error("care summary rows must stay empty when no medication has been saved");
}
