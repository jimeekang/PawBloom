import type { DiaryEntry } from "../../contexts/diary/domain/diaryEntry";
import type { DoseRecord } from "../../contexts/medication/domain/medication";
import { buildSampleDiaryEntries } from "../../contexts/diary/ui/sampleDiaryEntries";
import { buildSampleDoses } from "../../contexts/medication/ui/sampleDoses";
import { createChecklistFromRecords, createDashboardSummary, getTodayChecklistOrder } from "./todayChecklist";
import type { ChecklistKey } from "./todayChecklist";

const previewChecklist = createChecklistFromRecords(buildSampleDiaryEntries("pet-1"), buildSampleDoses("pet-1"));
if (previewChecklist.walk) throw new Error("preview checklist must keep walk incomplete when no walk record exists (a pre-completed walk blocks recording)");
if (!previewChecklist.medication) throw new Error("preview checklist must reflect the completed sample dose");
if (!previewChecklist.food || !previewChecklist.water || !previewChecklist.stool) throw new Error("preview checklist must match the sample diary records");

const checklist: Record<ChecklistKey, boolean> = {
  food: true,
  water: false,
  walk: false,
  stool: true,
  condition: true,
  memo: false,
  medication: true,
};

const entries: DiaryEntry[] = [
  { id: "condition-1", petId: "pet-1", category: "condition", origin: "diary", entryDate: "2026-06-28", occurredAt: "08:00", summary: "low", conditionScore: 2 },
  { id: "stool-1", petId: "pet-1", category: "stool", origin: "diary", entryDate: "2026-06-28", occurredAt: "09:00", summary: "stool", detail: { category: "stool", consistency: "diarrhea", hasBloodOrMucus: true } },
];

const doses: DoseRecord[] = [
  { id: "dose-1", petId: "pet-1", medicationName: "A", scheduledAt: "08:00", status: "pending" },
  { id: "dose-2", petId: "pet-1", medicationName: "B", scheduledAt: "12:00", status: "partial" },
];

const summary = createDashboardSummary(checklist, entries, doses);

if (summary.completedCount !== 4 || summary.totalCount !== 7) throw new Error("dashboard summary must count completed checklist items");
if (summary.pendingMedicationCount !== 1) throw new Error("dashboard summary must count pending medication doses");
if (!summary.attentionSignals.some((signal) => signal.includes("컨디션"))) throw new Error("dashboard summary must flag low condition score");
if (!summary.attentionSignals.some((signal) => signal.includes("물"))) throw new Error("dashboard summary must flag missing water record");
if (!summary.attentionSignals.some((signal) => signal.includes("투약"))) throw new Error("dashboard summary must flag partial or skipped medication");
if (!summary.attentionSignals.some((signal) => signal.includes("배변"))) throw new Error("dashboard summary must flag stool diarrhea or blood concerns");

const diaryOnlyKeys = getTodayChecklistOrder({ walkEnabled: false, includeMedication: false });
if (diaryOnlyKeys.includes("walk")) throw new Error("today checklist must hide walk when the pet routine disables walks");
if (diaryOnlyKeys.includes("medication")) throw new Error("today checklist must hide medication only when the caller explicitly suppresses it");
if (!diaryOnlyKeys.includes("condition")) throw new Error("today checklist must keep condition in the normal diary flow");
if (!diaryOnlyKeys.includes("memo")) throw new Error("today checklist must expose memo in the normal diary flow");

const careKeys = getTodayChecklistOrder({ walkEnabled: true, includeMedication: true });
if (!careKeys.includes("walk")) throw new Error("today checklist must show walk when enabled");
if (!careKeys.includes("medication")) throw new Error("today checklist must show medication when care records exist");

const defaultKeys = getTodayChecklistOrder({ walkEnabled: true });
if (!defaultKeys.includes("medication")) throw new Error("today checklist must show medication by default");

const diarySummary = createDashboardSummary(checklist, entries, doses, diaryOnlyKeys);
if (diarySummary.totalCount !== diaryOnlyKeys.length) throw new Error("dashboard summary must count only visible checklist items");
if (diarySummary.pendingMedicationCount !== 0) throw new Error("dashboard summary must hide pending medication count when medication is not visible");
if (diarySummary.attentionSignals.some((signal) => signal.includes("투약"))) throw new Error("dashboard summary must hide medication attention when medication is not visible");

const scheduledSummary = createDashboardSummary(checklist, entries, [], undefined, [{ status: "pending" }]);
if (scheduledSummary.pendingMedicationCount !== 1) {
  throw new Error("dashboard must count pending scheduled medication before a dose row is saved");
}
