import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../shared-kernel/supabase/client";
import type { Database, Json } from "../../../shared-kernel/supabase/database.types";
import type { Species } from "../../pet/domain/pet";
import type { PetRoutine, PetRoutineInput } from "../domain/petRoutine";
import { createDefaultPetRoutine } from "./petRoutineDefaults";

export { createDefaultPetRoutine };

type RoutineRow = Database["public"]["Tables"]["pet_routines"]["Row"];
type RoutineInsert = Database["public"]["Tables"]["pet_routines"]["Insert"];

export const petRoutineKeys = {
  detail: (petId: string | null, species?: Species, userId: string | null = null) => ["pet_routine", petId, species ?? "dog", userId] as const,
};

export function usePetRoutine(petId: string | null, species: Species = "dog", userId: string | null = null) {
  return useQuery({
    queryKey: petRoutineKeys.detail(petId, species, userId),
    enabled: Boolean(supabase && petId && userId),
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
      queryClient.setQueryData(petRoutineKeys.detail(petId, species, userId), routine);
      void queryClient.invalidateQueries({ queryKey: petRoutineKeys.detail(petId, species, userId) });
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
