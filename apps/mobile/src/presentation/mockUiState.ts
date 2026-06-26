import type { DiaryCategory, DiaryEntry } from "../contexts/diary/domain/diaryEntry";
import type { DoseRecord, DoseStatus } from "../contexts/medication/domain/medication";
import type { PetProfile } from "../contexts/pet/domain/pet";
import { sampleDoses, sampleEntries, samplePet } from "./sampleData";

export type ChecklistKey = DiaryCategory | "medication" | "night";
export type ReportStage = "empty" | "draft" | "confirmed" | "shared";

export type DraftDiaryEntry = {
  category: DiaryCategory;
  summary: string;
  occurredAt: string;
  conditionScore?: 1 | 2 | 3 | 4 | 5;
};

export const mockPets: PetProfile[] = [
  { ...samplePet, id: "pet-demo-mochi", name: "Mochi", breed: "Shiba Inu", ageLabel: "2y 3m", weightKg: 9.2 },
  { ...samplePet, id: "pet-demo-luna", name: "Luna", breed: "Korean shorthair", ageLabel: "5y", weightKg: 4.1, careMode: false },
];

export const initialChecklist: Record<ChecklistKey, boolean> = {
  food: true,
  water: true,
  walk: true,
  stool: true,
  condition: false,
  memo: false,
  medication: false,
  night: false,
};

export const initialDiaryEntries: DiaryEntry[] = sampleEntries.map((entry, index) => ({
  ...entry,
  id: `entry-ui-${index + 1}`,
  petId: mockPets[0].id,
}));

export const initialDoses: DoseRecord[] = sampleDoses.map((dose, index) => ({
  ...dose,
  id: `dose-ui-${index + 1}`,
  petId: mockPets[0].id,
  medicationName: index === 0 ? "Probiotic" : "Heartworm prevention",
  scheduledAt: index === 0 ? "08:10" : "20:00",
}));

export function createMockDiaryEntry(petId: string, draft: DraftDiaryEntry): DiaryEntry {
  return {
    id: `entry-local-${Date.now()}`,
    petId,
    category: draft.category,
    occurredAt: draft.occurredAt,
    summary: draft.summary || defaultSummary[draft.category],
    conditionScore: draft.category === "condition" ? draft.conditionScore ?? 3 : undefined,
  };
}

export function nextDoseStatus(status: DoseStatus): DoseStatus {
  if (status === "pending") return "completed";
  if (status === "completed") return "partial";
  if (status === "partial") return "skipped";
  return "pending";
}

const defaultSummary: Record<DiaryCategory, string> = {
  food: "Ate well",
  water: "Water intake recorded",
  walk: "Walk completed",
  stool: "Stool recorded",
  condition: "Condition checked",
  memo: "Memo added",
};
