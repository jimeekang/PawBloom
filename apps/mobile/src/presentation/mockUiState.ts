import type { DiaryCategory, DiaryDetailInput, DiaryEntry, DiaryPhotoInput } from "../contexts/diary/domain/diaryEntry";
import type { DoseRecord, DoseStatus } from "../contexts/medication/domain/medication";
import type { PetProfile } from "../contexts/pet/domain/pet";
import { sampleDoses, sampleEntries, samplePet } from "./sampleData";

export type ChecklistKey = DiaryCategory | "medication" | "night";
export type ReportStage = "empty" | "draft" | "confirmed" | "shared";

export type DraftDiaryEntry = {
  category: DiaryCategory;
  summary: string;
  entryDate?: string;
  occurredAt: string;
  detail?: DiaryDetailInput;
  conditionScore?: 1 | 2 | 3 | 4 | 5;
  photos?: DiaryPhotoInput[];
};

export const mockPets: PetProfile[] = [
  { ...samplePet, id: "pet-demo-mochi", name: "모찌", breed: "시바", ageLabel: "2살 3개월", weightKg: 9.2 },
  { ...samplePet, id: "pet-demo-luna", name: "루나", breed: "코리안 숏헤어", ageLabel: "5살", weightKg: 4.1, careMode: false },
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
  medicationName: index === 0 ? "프로바이오틱스" : "심장사상충 예방약",
  scheduledAt: index === 0 ? "08:10" : "20:00",
}));

export function createMockDiaryEntry(petId: string, draft: DraftDiaryEntry): DiaryEntry {
  return {
    id: `entry-local-${Date.now()}`,
    petId,
    category: draft.category,
    entryDate: draft.entryDate ?? getLocalDateKey(),
    occurredAt: draft.occurredAt,
    summary: draft.summary || defaultSummary[draft.category],
    detail: draft.detail,
    conditionScore: draft.category === "condition" ? draft.conditionScore ?? 3 : undefined,
    photoCount: draft.photos?.length ?? 0,
  };
}

export function nextDoseStatus(status: DoseStatus): DoseStatus {
  if (status === "pending") return "completed";
  if (status === "completed") return "partial";
  if (status === "partial") return "skipped";
  return "pending";
}

const defaultSummary: Record<DiaryCategory, string> = {
  food: "잘 먹음",
  water: "물 섭취 기록",
  walk: "산책 완료",
  stool: "배변 기록",
  condition: "컨디션 확인",
  memo: "메모 추가",
};

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
