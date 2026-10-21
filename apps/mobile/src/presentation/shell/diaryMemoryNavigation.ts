import type { DiaryEntry } from "../../contexts/diary/domain/diaryEntry";
import type { PetProfile } from "../../contexts/pet/domain/pet";
import { can } from "../../shared-kernel/permissions";
import type { AppRoute } from "../navigation/appRoute";
/** Rechecks delayed edits against current route, membership and source before delivery. */
export function canOpenDiaryMemory(entry: DiaryEntry, route: AppRoute, pets: readonly PetProfile[]) {
  const pet = pets.find((item) => item.id === entry.petId);
  return Boolean(pet && can(pet.role, "diary.update") && entry.origin === "diary" && route.kind === "pet" && route.petId === entry.petId && route.section === "care" && route.destination.view === "diary" && route.destination.entryId === entry.id);
}
