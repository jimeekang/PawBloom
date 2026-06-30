import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../shared-kernel/supabase/client";
import type { Database } from "../../../shared-kernel/supabase/database.types";
import type { ActiveCareSetup, CareConditionStatus, CareDoseStatus, CareMedicationSchedule, CareSetupInput } from "../domain/carePlan";

type ConditionRow = Database["public"]["Tables"]["conditions"]["Row"];
type CarePlanRow = Database["public"]["Tables"]["care_plans"]["Row"];
type MedicationRow = Database["public"]["Tables"]["medications"]["Row"];
type ScheduleRow = Database["public"]["Tables"]["medication_schedules"]["Row"];

export const carePlanKeys = {
  active: (petId: string | null) => ["care_setup", "active", petId] as const,
};

export function buildQuickDoseFromSchedule<TStatus extends CareDoseStatus = "pending">(schedule: CareMedicationSchedule, status: TStatus = "pending" as TStatus) {
  return { conditionName: schedule.conditionName, medicationName: schedule.medicationName, dosageLabel: schedule.dosageLabel, administeredAmount: "", reactionNote: "", status };
}

export function useActiveCareSetup(petId: string | null) {
  return useQuery({
    queryKey: carePlanKeys.active(petId),
    enabled: Boolean(supabase && petId),
    queryFn: async () => {
      if (!supabase || !petId) return emptyCareSetup();
      const [conditions, plans, medications, schedules] = await Promise.all([
        supabase.from("conditions").select("id,pet_id,name,status,vet_instructions,starts_on,ends_on,created_by,created_at,updated_at").eq("pet_id", petId).eq("status", "active").order("created_at", { ascending: false }),
        supabase.from("care_plans").select("id,pet_id,condition_id,title,instructions,starts_on,ends_on,created_by,created_at,updated_at").eq("pet_id", petId).order("created_at", { ascending: false }),
        supabase.from("medications").select("id,pet_id,condition_id,name,dosage_label,vet_instructions,created_by,created_at,updated_at").eq("pet_id", petId).order("created_at", { ascending: false }),
        supabase.from("medication_schedules").select("id,pet_id,medication_id,local_time,starts_on,ends_on,created_by,created_at").eq("pet_id", petId).order("local_time", { ascending: true }),
      ]);
      const error = conditions.error ?? plans.error ?? medications.error ?? schedules.error;
      if (error) throw new Error(error.message);
      return mapCareSetup(conditions.data ?? [], plans.data ?? [], medications.data ?? [], schedules.data ?? []);
    },
  });
}

export function useCreateCareSetup(petId: string | null, userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CareSetupInput) => {
      if (!supabase || !petId || !userId) throw new Error("로그인이 필요합니다.");
      const condition = await insertCondition(petId, userId, input.conditionName);
      await supabase.from("care_plans").insert({ pet_id: petId, created_by: userId, condition_id: condition?.id ?? null, title: input.planTitle.trim() || input.conditionName.trim() || "Care plan", instructions: input.instructions?.trim() || null });
      if (input.medicationName.trim()) {
        const { data: medication, error } = await supabase.from("medications").insert({ pet_id: petId, created_by: userId, condition_id: condition?.id ?? null, name: input.medicationName.trim(), dosage_label: input.dosageLabel.trim() || "용량 확인 필요" }).select().single();
        if (error) throw new Error(error.message);
        const { error: scheduleError } = await supabase.from("medication_schedules").insert({ pet_id: petId, created_by: userId, medication_id: medication.id, local_time: normalizeCareLocalTime(input.localTime) });
        if (scheduleError) throw new Error(scheduleError.message);
      }
      return true;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: carePlanKeys.active(petId) });
    },
  });
}

async function insertCondition(petId: string, userId: string, name: string) {
  if (!name.trim()) return null;
  const { data, error } = await supabase!.from("conditions").insert({ pet_id: petId, created_by: userId, name: name.trim() }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export function mapCareSetupForTest(conditions: ConditionRow[], plans: CarePlanRow[], medications: MedicationRow[], schedules: ScheduleRow[]): ActiveCareSetup {
  return mapCareSetup(conditions, plans, medications, schedules);
}

function mapCareSetup(conditions: ConditionRow[], plans: CarePlanRow[], medications: MedicationRow[], schedules: ScheduleRow[]): ActiveCareSetup {
  const conditionById = new Map(conditions.map((condition) => [condition.id, condition]));
  const medicationById = new Map(medications.map((medication) => [medication.id, medication]));
  const condition = conditions[0];
  const plan = plans.find((item) => item.condition_id === condition?.id) ?? plans[0];
  return {
    condition: condition ? { id: condition.id, name: condition.name, status: normalizeCareConditionStatus(condition.status), startsOn: condition.starts_on } : undefined,
    plan: plan ? { id: plan.id, title: plan.title, instructions: plan.instructions ?? undefined, startsOn: plan.starts_on } : undefined,
    conditionName: condition?.name,
    planTitle: plan?.title,
    instructions: plan?.instructions ?? undefined,
    schedules: schedules.flatMap((schedule) => {
      const medication = medicationById.get(schedule.medication_id);
      if (!medication) return [];
      return [{ id: schedule.id, medicationId: medication.id, medicationName: medication.name, dosageLabel: medication.dosage_label, conditionName: medication.condition_id ? conditionById.get(medication.condition_id)?.name : undefined, localTime: schedule.local_time }];
    }),
  };
}

function emptyCareSetup(): ActiveCareSetup {
  return { schedules: [] };
}

function normalizeCareConditionStatus(value: string): CareConditionStatus {
  if (value === "resolved" || value === "archived") return value;
  return "active";
}

export function normalizeCareLocalTime(value: string) {
  const [rawHour, rawMinute] = value.split(":");
  if (!rawHour?.trim()) return "08:00:00";
  const hour = Number(rawHour?.trim());
  const minute = Number(rawMinute?.trim() || "0");
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return "08:00:00";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}
