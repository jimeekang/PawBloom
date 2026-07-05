import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../shared-kernel/supabase/client";
import type { Database, Json } from "../../../shared-kernel/supabase/database.types";
import type { Species } from "../../pet/domain/pet";
import type { PetRoutine, PetRoutineInput } from "../domain/petRoutine";

type RoutineRow = Database["public"]["Tables"]["pet_routines"]["Row"];
type RoutineInsert = Database["public"]["Tables"]["pet_routines"]["Insert"];
export type RoutineCategory = "food" | "water" | "walk" | "stool" | "condition" | "memo" | "photo";
type RoutineDiaryDetail =
  | { category: "food"; meals: PetRoutine["food"]["meals"]; appetite?: PetRoutine["food"]["appetite"] }
  | { category: "water"; amountMl?: string; intakeLevel?: PetRoutine["water"]["intakeLevel"] }
  | { category: "walk"; durationMinutes?: string; intensity?: PetRoutine["walk"]["intensity"]; observation?: string; stoolObservation?: string; urineObservation?: string; symptomNote?: string }
  | { category: "stool"; count?: string; consistency?: PetRoutine["stool"]["consistency"]; hasBloodOrMucus?: boolean }
  | { category: "condition"; energyLevel?: PetRoutine["condition"]["energyLevel"]; discomfortNote?: string }
  | { category: "memo" };

export const petRoutineKeys = {
  detail: (petId: string | null, species?: Species) => ["pet_routine", petId, species ?? "dog"] as const,
};

export function createDefaultPetRoutine(petId: string, species: Species = "dog"): PetRoutine {
  return { petId, food: { meals: { breakfast: {}, lunch: {}, dinner: {} }, appetite: "normal" }, water: { intakeLevel: "normal" }, walk: { enabled: species === "dog", intensity: "normal" }, stool: { consistency: "normal" }, condition: { energyLevel: "normal" } };
}

export function getDiaryCategoriesForSpecies(species: Species, walkEnabled = species === "dog"): RoutineCategory[] {
  return walkEnabled
    ? ["food", "water", "walk", "stool", "condition", "memo", "photo"]
    : ["food", "water", "stool", "condition", "memo", "photo"];
}

export function buildRoutineDiaryDetail(category: RoutineCategory, routine: PetRoutine): RoutineDiaryDetail {
  if (category === "food") return { category, meals: routine.food.meals, appetite: routine.food.appetite };
  if (category === "water") return { category, amountMl: routine.water.amountMl, intakeLevel: routine.water.intakeLevel };
  if (category === "walk") return routine.walk.enabled === false ? { category } : { category, durationMinutes: routine.walk.durationMinutes, intensity: routine.walk.intensity };
  if (category === "stool") return { category, count: routine.stool.count, consistency: routine.stool.consistency, hasBloodOrMucus: false };
  if (category === "condition") return { category, energyLevel: routine.condition.energyLevel };
  return { category: "memo" };
}

export function usePetRoutine(petId: string | null, species: Species = "dog") {
  return useQuery({
    queryKey: petRoutineKeys.detail(petId, species),
    enabled: Boolean(supabase && petId),
    queryFn: async () => {
      if (!supabase || !petId) return null;
      const { data, error } = await supabase.from("pet_routines").select("id,pet_id,routine,created_by,created_at,updated_at").eq("pet_id", petId).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapRoutineRow(data, species) : createDefaultPetRoutine(petId, species);
    },
  });
}

export function useUpsertPetRoutine(petId: string | null, userId: string | null, species: Species = "dog") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: PetRoutineInput) => {
      if (!supabase || !petId || !userId) throw new Error("로그인이 필요합니다.");
      const payload: RoutineInsert = { pet_id: petId, created_by: userId, routine: input as unknown as Json, updated_at: new Date().toISOString() };
      const { data, error } = await supabase.from("pet_routines").upsert(payload, { onConflict: "pet_id" }).select().single();
      if (error) throw new Error(error.message);
      return mapRoutineRow(data, species);
    },
    onSuccess: (routine) => {
      queryClient.setQueriesData({ queryKey: ["pet_routine", petId] }, routine);
      void queryClient.invalidateQueries({ queryKey: ["pet_routine", petId] });
    },
  });
}

function mapRoutineRow(row: RoutineRow, species: Species): PetRoutine {
  const defaults = createDefaultPetRoutine(row.pet_id, species);
  const routine = row.routine as Partial<PetRoutineInput>;
  return {
    ...defaults,
    ...routine,
    food: { ...defaults.food, ...routine.food, meals: { ...defaults.food.meals, ...routine.food?.meals } },
    water: { ...defaults.water, ...routine.water },
    walk: { ...defaults.walk, ...routine.walk },
    stool: { ...defaults.stool, ...routine.stool },
    condition: { ...defaults.condition, ...routine.condition },
    id: row.id,
    petId: row.pet_id,
  };
}
