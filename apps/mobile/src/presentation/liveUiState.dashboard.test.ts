import type { DiaryEntry } from "../contexts/diary/domain/diaryEntry";
import type { DoseRecord } from "../contexts/medication/domain/medication";
import { createDashboardSummary } from "./liveUiState";
import type { ChecklistKey } from "./mockUiState";

const checklist: Record<ChecklistKey, boolean> = {
  food: true,
  water: false,
  walk: false,
  stool: true,
  condition: true,
  memo: false,
  medication: true,
  night: false,
};

const entries: DiaryEntry[] = [
  { id: "condition-1", petId: "pet-1", category: "condition", entryDate: "2026-06-28", occurredAt: "08:00", summary: "low", conditionScore: 2 },
  { id: "stool-1", petId: "pet-1", category: "stool", entryDate: "2026-06-28", occurredAt: "09:00", summary: "stool", detail: { category: "stool", consistency: "diarrhea", hasBloodOrMucus: true } },
];

const doses: DoseRecord[] = [
  { id: "dose-1", petId: "pet-1", medicationName: "A", scheduledAt: "08:00", status: "pending" },
  { id: "dose-2", petId: "pet-1", medicationName: "B", scheduledAt: "12:00", status: "partial" },
];

const summary = createDashboardSummary(checklist, entries, doses);

if (summary.completedCount !== 4 || summary.totalCount !== 8) throw new Error("dashboard summary must count completed checklist items");
if (summary.pendingMedicationCount !== 1) throw new Error("dashboard summary must count pending medication doses");
if (!summary.attentionSignals.some((signal) => signal.includes("컨디션"))) throw new Error("dashboard summary must flag low condition score");
if (!summary.attentionSignals.some((signal) => signal.includes("물"))) throw new Error("dashboard summary must flag missing water record");
if (!summary.attentionSignals.some((signal) => signal.includes("투약"))) throw new Error("dashboard summary must flag partial or skipped medication");
if (!summary.attentionSignals.some((signal) => signal.includes("배변"))) throw new Error("dashboard summary must flag stool diarrhea or blood concerns");
