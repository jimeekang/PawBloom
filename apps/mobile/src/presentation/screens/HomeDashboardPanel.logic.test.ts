import { createCareSummaryAgendaCounts, createCareSummaryDoseRows, createCareSummaryRows } from "./HomeDashboardPanel.logic";

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

// 0006 B8 — with a pending scheduled agenda row and no recorded dose, the
// card must count 0/1 (matching the hero) instead of the contradictory 0/0.
const pendingScheduleRow = {
  doseId: undefined,
  scheduleId: "schedule-1",
  doseDate: "2026-07-23",
  medicationName: "Amoxi",
  conditionName: "Cough",
  dosageLabel: "1 tablet",
  scheduledTime: "08:00",
  status: "pending" as const,
};

const agendaCounts = createCareSummaryAgendaCounts([], [pendingScheduleRow]);
if (agendaCounts.completedCount !== 0 || agendaCounts.totalCount !== 1) {
  throw new Error("card counts must follow the agenda so scheduled-but-unrecorded doses count as pending");
}

const agendaRows = createCareSummaryRows([], [pendingScheduleRow]);
if (agendaRows.length !== 1 || agendaRows[0]?.title !== "Amoxi" || agendaRows[0]?.timeLabel !== "08:00") {
  throw new Error("scheduled pending medication must appear in the expanded care summary list");
}

const orderedRows = createCareSummaryRows([
  {
    id: "dose-evening",
    petId: "pet-1",
    medicationName: "Evening dose",
    scheduledAt: "20:00",
    status: "completed",
  },
], [
  {
    ...pendingScheduleRow,
    scheduleId: "schedule-afternoon",
    medicationName: "Afternoon dose",
    scheduledTime: "13:00",
  },
  {
    ...pendingScheduleRow,
    doseId: "dose-evening",
    scheduleId: "schedule-evening",
    medicationName: "Evening dose",
    scheduledTime: "20:00",
  },
  {
    ...pendingScheduleRow,
    scheduleId: "schedule-morning",
    medicationName: "Morning dose",
    scheduledTime: "08:00",
  },
]);

if (orderedRows.map((row) => row.timeLabel).join(",") !== "08:00,13:00,20:00") {
  throw new Error("home care summary must follow the care screen's ascending local-time order");
}

if (orderedRows[2]?.id !== "dose-evening") {
  throw new Error("time ordering must preserve the saved dose details for recorded agenda rows");
}
