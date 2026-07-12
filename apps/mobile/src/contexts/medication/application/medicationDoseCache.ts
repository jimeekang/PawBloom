import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { DoseRecord } from "../domain/medication";

export function removeMedicationDoseFromList<T extends { id: string }>(doses: T[] | undefined, id: string) {
  return (doses ?? []).filter((dose) => dose.id !== id);
}

export function replaceMedicationDoseInList<T extends { id: string }>(doses: T[] | undefined, saved: T) {
  return (doses ?? []).map((dose) => (dose.id === saved.id ? saved : dose));
}

export function findMedicationDoseInCachedLists(queryClient: QueryClient, petId: string | null, userId: string | null, id: string) {
  for (const [queryKey, current] of queryClient.getQueriesData<DoseRecord[]>({ queryKey: ["medication_doses"] })) {
    if (Array.isArray(current) && isMedicationDoseListCacheForPet(queryKey, petId, userId)) {
      const dose = current.find((item) => item.id === id);
      if (dose) return dose;
    }
  }
  return undefined;
}

export function removeMedicationDoseFromCachedLists(queryClient: QueryClient, petId: string | null, userId: string | null, id: string) {
  for (const [queryKey, current] of queryClient.getQueriesData<DoseRecord[]>({ queryKey: ["medication_doses"] })) {
    if (Array.isArray(current) && isMedicationDoseListCacheForPet(queryKey, petId, userId)) queryClient.setQueryData<DoseRecord[]>(queryKey, removeMedicationDoseFromList(current, id));
  }
}

export function replaceMedicationDoseInCachedLists(queryClient: QueryClient, petId: string | null, userId: string | null, saved: DoseRecord) {
  for (const [queryKey, current] of queryClient.getQueriesData<DoseRecord[]>({ queryKey: ["medication_doses"] })) {
    if (Array.isArray(current) && isMedicationDoseListCacheForPet(queryKey, petId, userId)) queryClient.setQueryData<DoseRecord[]>(queryKey, replaceMedicationDoseInList(current, saved));
  }
}

function isMedicationDoseListCacheForPet(queryKey: QueryKey, petId: string | null, userId: string | null) {
  return queryKey[0] === "medication_doses" && (queryKey[1] === "today" || queryKey[1] === "range") && queryKey[2] === petId && queryKey.at(-1) === userId;
}
