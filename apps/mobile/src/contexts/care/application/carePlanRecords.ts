import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../shared-kernel/supabase/client";
import type { Database } from "../../../shared-kernel/supabase/database.types";
import { mapMedicationSchedules, normalizeMedicationLocalTime } from "../../medication/application/medicationScheduleRecords";
import type { ActiveCareSetup, CareConditionStatus, CareDoseStatus, CareMedicationSchedule, CareSetupInput } from "../domain/carePlan";
import { saveCareSetupRecords } from "./carePlanPersistence";

export { buildCareScheduleRequests } from "./carePlanPersistence";

type ConditionRow = Database["public"]["Tables"]["conditions"]["Row"];
type CarePlanRow = Database["public"]["Tables"]["care_plans"]["Row"];
type MedicationRow = Database["public"]["Tables"]["medications"]["Row"];
type ScheduleRow = Database["public"]["Tables"]["medication_schedules"]["Row"];

export const carePlanKeys = {
  active: (petId: string | null, userId: string | null = null) => ["care_setup", "active", petId, userId] as const,
};

export function buildQuickDoseFromSchedule<TStatus extends CareDoseStatus = "pending">(schedule: CareMedicationSchedule, status: TStatus = "pending" as TStatus) {
  return { scheduleId: schedule.id, conditionName: schedule.conditionName, medicationName: schedule.medicationName, dosageLabel: schedule.dosageLabel, administeredAmount: "", reactionNote: "", status };
}

export function useActiveCareSetup(petId: string | null, userId: string | null = null) {
  return useQuery({
    queryKey: carePlanKeys.active(petId, userId),
    enabled: Boolean(supabase && petId && userId),
    queryFn: async () => {
      if (!supabase || !petId) return emptyCareSetup();
      return fetchActiveCareSetup(petId);
    },
  });
}

export function useCreateCareSetup(petId: string | null, userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CareSetupInput) => {
      if (!supabase || !petId || !userId) throw new Error("로그인이 필요합니다.");
      return saveCareSetupRecords(petId, input);
    },
    onSuccess: (setup) => {
      queryClient.setQueryData(carePlanKeys.active(petId, userId), setup);
    },
  });
}

async function fetchActiveCareSetup(petId: string) {
  const [conditions, plans, medications, schedules] = await Promise.all([
    supabase!.from("conditions").select("id,pet_id,name,status,vet_instructions,starts_on,ends_on,created_by,created_at,updated_at").eq("pet_id", petId).eq("status", "active").order("created_at", { ascending: false }),
    supabase!.from("care_plans").select("id,pet_id,condition_id,title,instructions,starts_on,ends_on,created_by,created_at,updated_at").eq("pet_id", petId).order("created_at", { ascending: false }),
    supabase!.from("medications").select("id,pet_id,condition_id,name,dosage_label,vet_instructions,created_by,created_at,updated_at").eq("pet_id", petId).order("created_at", { ascending: false }),
    supabase!.from("medication_schedules").select("id,pet_id,medication_id,local_time,starts_on,ends_on,recurrence_interval_days,created_by,created_at").eq("pet_id", petId).order("local_time", { ascending: true }),
  ]);
  const error = conditions.error ?? plans.error ?? medications.error ?? schedules.error;
  if (error) throw new Error(error.message);
  return mapCareSetup(conditions.data ?? [], plans.data ?? [], medications.data ?? [], schedules.data ?? []);
}

export function mapCareSetupForTest(conditions: ConditionRow[], plans: CarePlanRow[], medications: MedicationRow[], schedules: ScheduleRow[]): ActiveCareSetup {
  return mapCareSetup(conditions, plans, medications, schedules);
}

function mapCareSetup(conditions: ConditionRow[], plans: CarePlanRow[], medications: MedicationRow[], schedules: ScheduleRow[]): ActiveCareSetup {
  const activeConditions = conditions.map((item) => ({ id: item.id, name: item.name, status: normalizeCareConditionStatus(item.status), startsOn: item.starts_on, endsOn: item.ends_on ?? undefined }));
  const activePlans = plans.map((item) => ({
    id: item.id,
    conditionId: item.condition_id ?? undefined,
    title: item.title,
    instructions: item.instructions ?? undefined,
    startsOn: item.starts_on,
    endsOn: item.ends_on ?? undefined,
  }));
  const condition = conditions[0];
  const plan = activePlans.find((item) => item.conditionId === condition?.id) ?? activePlans[0];
  return {
    conditions: activeConditions,
    plans: activePlans,
    condition: activeConditions[0],
    plan,
    conditionName: activeConditions[0]?.name,
    planTitle: plan?.title,
    instructions: plan?.instructions,
    schedules: mapMedicationSchedules(medications, schedules, conditions),
  };
}

function emptyCareSetup(): ActiveCareSetup {
  return { conditions: [], plans: [], schedules: [] };
}

function normalizeCareConditionStatus(value: string): CareConditionStatus {
  if (value === "resolved" || value === "archived") return value;
  return "active";
}

export function normalizeCareLocalTime(value: string) {
  return normalizeMedicationLocalTime(value);
}
