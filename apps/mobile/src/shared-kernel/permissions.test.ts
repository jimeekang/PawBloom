import { can, type PetAction } from "./permissions";
import type { AppRole } from "./types";

const expected: Record<AppRole, PetAction[]> = {
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

const everyAction = [...new Set(Object.values(expected).flat())];
for (const [role, allowedActions] of Object.entries(expected) as Array<[AppRole, PetAction[]]>) {
  for (const action of everyAction) {
    if (can(role, action) !== allowedActions.includes(action)) {
      throw new Error(`${role} permission mismatch for ${action}`);
    }
  }
}

if (can("caregiver", "report.confirm")) throw new Error("caregiver drafts must require owner confirmation");
if (can("caregiver", "report.generate") || can("caregiver", "report.share") || can("caregiver", "report.read")) throw new Error("vet report management must remain owner-only");
if (can("pet_sitter", "diary.update")) throw new Error("pet sitters must not update existing diary records");
if (!can("pet_sitter", "medication.update")) throw new Error("pet sitters must be able to update dose status");
