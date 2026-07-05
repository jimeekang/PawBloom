import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../shared-kernel/supabase/client";
import type { Database } from "../../../shared-kernel/supabase/database.types";
import type { MedicationScheduleInput } from "../domain/medicationSchedule";
import { buildMedicationScheduleInsertRows, mapMedicationSchedules } from "./medicationSchedulePayload";
export { buildMedicationScheduleInsertRows, buildScheduledMedicationDoseInput, mapMedicationSchedules, mapMedicationSchedulesForTest, normalizeMedicationLocalTime } from "./medicationSchedulePayload";

type MedicationRow = Database["public"]["Tables"]["medications"]["Row"];
type ScheduleRow = Database["public"]["Tables"]["medication_schedules"]["Row"];

export const medicationScheduleKeys = {
  byPet: (petId: string | null) => ["medication_schedules", "by_pet", petId] as const,
};

export function useMedicationSchedules(petId: string | null) {
  return useQuery({
    queryKey: medicationScheduleKeys.byPet(petId),
    enabled: Boolean(supabase && petId),
    queryFn: async () => {
      if (!supabase || !petId) return [];
      const [medications, schedules] = await Promise.all([
        supabase.from("medications").select("id,pet_id,condition_id,name,dosage_label,vet_instructions,created_by,created_at,updated_at").eq("pet_id", petId),
        supabase.from("medication_schedules").select("id,pet_id,medication_id,local_time,starts_on,ends_on,recurrence_interval_days,created_by,created_at").eq("pet_id", petId).order("local_time", { ascending: true }),
      ]);
      const error = medications.error ?? schedules.error;
      if (error) throw new Error(error.message);
      return mapMedicationSchedules(medications.data ?? [], schedules.data ?? []);
    },
  });
}

export function useCreateMedicationSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: MedicationScheduleInput) => {
      if (!supabase) throw new Error("Supabase 클라이언트가 설정되어 있지 않습니다.");
      const { error } = await supabase.from("medication_schedules").insert(buildMedicationScheduleInsertRows(input));
      if (error) throw new Error(error.message);
      return true;
    },
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: medicationScheduleKeys.byPet(input.petId) });
    },
  });
}
