import type { AppRole } from "./types";

export type PetAction =
  | "pet.delete"
  | "member.invite"
  | "diary.write"
  | "medication.write"
  | "report.generate"
  | "report.read";

const roleActions: Record<AppRole, PetAction[]> = {
  owner: ["pet.delete", "member.invite", "diary.write", "medication.write", "report.generate", "report.read"],
  caregiver: ["diary.write", "medication.write", "report.read"],
  pet_sitter: ["diary.write", "medication.write"],
  vet_report_viewer: ["report.read"],
};

export function can(role: AppRole, action: PetAction) {
  return roleActions[role].includes(action);
}

