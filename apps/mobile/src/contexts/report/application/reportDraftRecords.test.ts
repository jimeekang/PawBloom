import type { DiaryEntry } from "../../diary/domain/diaryEntry";
import type { DoseRecord } from "../../medication/domain/medication";
import { createReportDraftSummary, getLast7DayReportRange, type ReportDraftSummary } from "./reportDraftRecords";

const entries: DiaryEntry[] = [
  {
    id: "entry-old-condition",
    petId: "pet-1",
    category: "condition",
    entryDate: "2026-06-22",
    occurredAt: "09:00",
    summary: "Low energy",
    conditionScore: 2,
  },
  {
    id: "entry-latest-condition",
    petId: "pet-1",
    category: "condition",
    entryDate: "2026-06-28",
    occurredAt: "09:00",
    summary: "More alert",
    conditionScore: 4,
  },
];

const doses: DoseRecord[] = [
  {
    id: "dose-pending",
    petId: "pet-1",
    medicationName: "Cerenia",
    scheduledAt: "08:30",
    status: "pending",
  },
  {
    id: "dose-partial",
    petId: "pet-1",
    medicationName: "Cerenia",
    scheduledAt: "12:30",
    status: "partial",
    recordedAt: "2026-06-28T08:35:00.000Z",
  },
  {
    id: "dose-skipped",
    petId: "pet-1",
    medicationName: "Cerenia",
    scheduledAt: "18:30",
    status: "skipped",
    recordedAt: "2026-06-28T18:35:00.000Z",
  },
  {
    id: "dose-completed",
    petId: "pet-1",
    medicationName: "Cerenia",
    scheduledAt: "20:30",
    status: "completed",
    recordedAt: "2026-06-28T20:35:00.000Z",
  },
];

const summary: ReportDraftSummary = createReportDraftSummary(entries, doses);
const range = getLast7DayReportRange(new Date(2026, 5, 28));

const hasRecords: boolean = summary.hasRecords;
const diaryCount: number = summary.diaryCount;
const attentionCount: number = summary.medicationAttentionCount;
const trend: ReportDraftSummary["conditionTrend"]["direction"] = summary.conditionTrend.direction;
const fromDateKey: string = range.fromDateKey;
const toDateKey: string = range.toDateKey;

if (summary.medicationAttentionCount !== 2) {
  throw new Error("Medication attention count should include only partial and skipped doses.");
}

void hasRecords;
void diaryCount;
void attentionCount;
void trend;
void fromDateKey;
void toDateKey;
