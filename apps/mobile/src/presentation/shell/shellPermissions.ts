import type { PetProfile } from "../../contexts/pet/domain/pet";
import { can } from "../../shared-kernel/permissions";

export function getShellPermissions(role: PetProfile["role"]) {
  return {
    canCreateDiary: can(role, "diary.create"),
    canDeleteDiary: can(role, "diary.delete"),
    canManageCare: can(role, "care.update"),
    canDeleteDose: can(role, "medication.delete"),
    canGenerateReport: can(role, "report.generate"),
    canShareReport: can(role, "report.share"),
    canReadReport: can(role, "report.read"),
  };
}
