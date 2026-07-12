import type { AppRole } from "./types";

export type PetAction =
  | "pet.update"
  | "pet.delete"
  | "pet.photo.update"
  | "member.invite"
  | "diary.create"
  | "diary.update"
  | "diary.delete"
  | "medication.create"
  | "medication.update"
  | "medication.delete"
  | "care.update"
  | "routine.update"
  | "report.generate"
  | "report.confirm"
  | "report.share"
  | "report.read";

const roleActions: Record<AppRole, PetAction[]> = {
  owner: [
    "pet.update", "pet.delete", "pet.photo.update", "member.invite",
    "diary.create", "diary.update", "diary.delete",
    "medication.create", "medication.update", "medication.delete",
    "care.update", "routine.update",
    "report.generate", "report.confirm", "report.share", "report.read",
  ],
  caregiver: [
    "diary.create", "diary.update",
    "medication.create", "medication.update",
    "care.update", "routine.update",
  ],
  pet_sitter: ["diary.create", "medication.create", "medication.update"],
  vet_report_viewer: ["report.read"],
};

export function can(role: AppRole, action: PetAction) {
  return roleActions[role].includes(action);
}
