import { buildDoseRecordedAt, shouldCountDoseAsMedicationRecorded } from "./medicationDoseRecords";

const pendingRecordedAt: string | null = buildDoseRecordedAt("pending", new Date("2026-06-28T08:30:00.000Z"));
const completedRecordedAt: string | null = buildDoseRecordedAt("completed", new Date("2026-06-28T08:30:00.000Z"));
const partialRecordedAt: string | null = buildDoseRecordedAt("partial", new Date("2026-06-28T08:30:00.000Z"));
const skippedRecordedAt: string | null = buildDoseRecordedAt("skipped", new Date("2026-06-28T08:30:00.000Z"));
const pendingChecklist: boolean = shouldCountDoseAsMedicationRecorded("pending");
const partialChecklist: boolean = shouldCountDoseAsMedicationRecorded("partial");

void pendingRecordedAt;
void completedRecordedAt;
void partialRecordedAt;
void skippedRecordedAt;
void pendingChecklist;
void partialChecklist;
