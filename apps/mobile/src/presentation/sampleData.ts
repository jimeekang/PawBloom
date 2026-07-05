import type { AiBrief } from "../contexts/briefing/domain/aiBrief";
import type { DiaryEntry } from "../contexts/diary/domain/diaryEntry";
import type { DoseRecord } from "../contexts/medication/domain/medication";
import type { PetProfile } from "../contexts/pet/domain/pet";
import type { VetReport } from "../contexts/report/domain/vetReport";

const todayKey = getLocalDateKey();

export const samplePet: PetProfile = {
  id: "pet-demo-milo",
  name: "밀로",
  species: "dog",
  breed: "카보돌",
  birthdate: "2021-05-12",
  ageLabel: "4살",
  weightKg: 8.4,
  careMode: true,
};

export const sampleEntries: DiaryEntry[] = [
  {
    id: "entry-food",
    petId: samplePet.id,
    category: "food",
    origin: "diary",
    entryDate: todayKey,
    occurredAt: "08:15",
    summary: "아침식사 반만 먹음",
  },
  {
    id: "entry-water",
    petId: samplePet.id,
    category: "water",
    origin: "diary",
    entryDate: todayKey,
    occurredAt: "10:40",
    summary: "평소보다 물 섭취량이 적음",
  },
  {
    id: "entry-stool",
    petId: samplePet.id,
    category: "stool",
    origin: "diary",
    entryDate: todayKey,
    occurredAt: "18:20",
    summary: "대변 한 번 묽음",
  },
];

export const sampleDoses: DoseRecord[] = [
  {
    id: "dose-am",
    petId: samplePet.id,
    medicationName: "수의사 처방약",
    scheduledAt: "08:30",
    status: "completed",
    recordedAt: "08:34",
    reactionNote: "투약 후 구토 없음",
  },
  {
    id: "dose-pm",
    petId: samplePet.id,
    medicationName: "수의사 처방약",
    scheduledAt: "20:30",
    status: "pending",
  },
];

export const sampleBrief: AiBrief = {
  id: "brief-demo",
  petId: samplePet.id,
  rangeDays: 3,
  highlights: [
    "최근 기록에서 식욕이 평소보다 낮았습니다.",
    "오늘 묽은 대변이 한 번 기록되었습니다.",
    "오전에 투약이 제시간에 기록되었습니다.",
  ],
  questionsForVet: [
    "식욕 저하는 언제 시작되었나요?",
    "현재 투약 스케줄을 그대로 유지해도 될까요?",
  ],
  disclaimer: "이 내용은 진단이 아니라 기록 기반 요약입니다. 의학적 판단은 수의사에게 문의하세요.",
};

export const sampleReport: VetReport = {
  id: "report-demo",
  petId: samplePet.id,
  rangeDays: 7,
  status: "draft",
  englishSummary:
    "최근 기록에서 식욕이 줄었습니다. 오늘 물 섭취량이 적었고, 묽은 대변이 한 번 있었고, 오전 투약은 구토 없이 완료되었습니다.",
  confirmedByOwner: false,
  disclaimer: sampleBrief.disclaimer,
};

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
