import type { AiBrief } from "../contexts/briefing/domain/aiBrief";
import type { DiaryEntry } from "../contexts/diary/domain/diaryEntry";
import type { DoseRecord } from "../contexts/medication/domain/medication";
import type { PetProfile } from "../contexts/pet/domain/pet";
import type { VetReport } from "../contexts/report/domain/vetReport";

export const samplePet: PetProfile = {
  id: "pet-demo-milo",
  name: "Milo",
  species: "dog",
  breed: "Cavoodle",
  ageLabel: "4y",
  weightKg: 8.4,
  careMode: true,
};

export const sampleEntries: DiaryEntry[] = [
  {
    id: "entry-food",
    petId: samplePet.id,
    category: "food",
    occurredAt: "08:15",
    summary: "Ate about half of breakfast",
    conditionScore: 3,
  },
  {
    id: "entry-water",
    petId: samplePet.id,
    category: "water",
    occurredAt: "10:40",
    summary: "Drank less water than usual",
    conditionScore: 3,
  },
  {
    id: "entry-stool",
    petId: samplePet.id,
    category: "stool",
    occurredAt: "18:20",
    summary: "Soft stool once",
    conditionScore: 2,
  },
];

export const sampleDoses: DoseRecord[] = [
  {
    id: "dose-am",
    petId: samplePet.id,
    medicationName: "Vet-prescribed tablet",
    scheduledAt: "08:30",
    status: "completed",
    recordedAt: "08:34",
    reactionNote: "No vomiting after dose",
  },
  {
    id: "dose-pm",
    petId: samplePet.id,
    medicationName: "Vet-prescribed tablet",
    scheduledAt: "20:30",
    status: "pending",
  },
];

export const sampleBrief: AiBrief = {
  id: "brief-demo",
  petId: samplePet.id,
  rangeDays: 3,
  highlights: [
    "Appetite is lower than usual in the latest records.",
    "One soft stool entry was recorded today.",
    "Medication was recorded on time this morning.",
  ],
  questionsForVet: [
    "When did the reduced appetite start?",
    "Should the current medication schedule continue unchanged?",
  ],
  disclaimer: "This is a record-based summary, not a diagnosis. Contact a veterinarian for medical decisions.",
};

export const sampleReport: VetReport = {
  id: "report-demo",
  petId: samplePet.id,
  rangeDays: 7,
  status: "draft",
  englishSummary:
    "Milo has had reduced appetite in recent records. Water intake was lower than usual today, and soft stool was recorded once. Medication was given in the morning with no vomiting noted after administration.",
  confirmedByOwner: false,
  disclaimer: sampleBrief.disclaimer,
};

