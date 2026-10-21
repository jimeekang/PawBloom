import { useQueries } from "@tanstack/react-query";
import type { PetProfile } from "../../contexts/pet/domain/pet";
import type { DiaryEntry } from "../../contexts/diary/domain/diaryEntry";
import type { DoseRecord } from "../../contexts/medication/domain/medication";
import { petRoutineKeys, fetchPetRoutine, createDefaultPetRoutine } from "../../contexts/routine/application/petRoutineRecords";
import { carePlanKeys, fetchActiveCareSetup } from "../../contexts/care/application/carePlanRecords";
import { diaryKeys, fetchDiaryEntries } from "../../contexts/diary/application/diaryRecords";
import { medicationDoseKeys, fetchMedicationDoses } from "../../contexts/medication/application/medicationDoseRecords";
import { useLocalDateKey } from "../../shared-kernel/useLocalDateKey";
import type { TodayCarePetState } from "../screens/TodayCareScreen";
import { createAllPetsTodayCareItems } from "./todayCareItems";
export type AllPetsTodayCareResult = {
  /** Shared local date; updates on midnight/foreground. */
  dateKey: string;
  /** Partial failures remain visible in petStates; never interpreted as zero records. */
  status: "loading" | "ready" | "error";
  petStates: readonly TodayCarePetState[];
  /** Only this pet's four existing query keys are refetched. */
  retryPet: (petId: string) => Promise<void>;
};
/** Queries explicit IDs without selecting or mutating activePet. Existing user/pet caches are reused. */
export function useAllPetsTodayCare(userId: string | null, pets: readonly PetProfile[], preview?: { entries: DiaryEntry[]; doses: DoseRecord[] }): AllPetsTodayCareResult {
  const dateKey = useLocalDateKey();
  const enabled = Boolean(userId);
  const routines = useQueries({ queries: pets.map((pet) => ({ queryKey: petRoutineKeys.detail(pet.id, pet.species, userId), enabled, queryFn: () => fetchPetRoutine(pet.id, pet.species) })) });
  const care = useQueries({ queries: pets.map((pet) => ({ queryKey: carePlanKeys.active(pet.id, userId), enabled, queryFn: () => fetchActiveCareSetup(pet.id) })) });
  const doses = useQueries({ queries: pets.map((pet) => ({ queryKey: medicationDoseKeys.today(pet.id, dateKey, userId), enabled, queryFn: () => fetchMedicationDoses(pet.id, { fromDateKey: dateKey, toDateKey: dateKey, ascending: true }, userId) })) });
  const diaries = useQueries({ queries: pets.map((pet) => ({ queryKey: diaryKeys.date(pet.id, dateKey, userId), enabled, queryFn: () => fetchDiaryEntries(pet.id, dateKey, dateKey, userId) })) });
  const petStates: TodayCarePetState[] = pets.map((pet, i) => {
    const sources = [routines[i], care[i], doses[i], diaries[i]];
    const status = !enabled ? "ready" : sources.some((query) => query?.isError) ? "error" : sources.some((query) => !query?.data) ? "loading" : "ready";
    return { petId: pet.id, status, items: status !== "ready" ? [] : createAllPetsTodayCareItems(pet.id, dateKey, enabled ? routines[i]!.data! : createDefaultPetRoutine(pet.id, pet.species), enabled ? care[i]!.data!.schedules : [], enabled ? doses[i]!.data! : preview?.doses ?? [], enabled ? diaries[i]!.data! : preview?.entries ?? []) };
  });
  return { dateKey, petStates, status: petStates.some((state) => state.status === "error") ? "error" : petStates.some((state) => state.status === "loading") ? "loading" : "ready", retryPet: async (petId) => {
    const index = pets.findIndex((pet) => pet.id === petId);
    if (index < 0 || !enabled) return;
    await Promise.all([routines[index], care[index], doses[index], diaries[index]].map((query) => query!.refetch()));
  } };
}
