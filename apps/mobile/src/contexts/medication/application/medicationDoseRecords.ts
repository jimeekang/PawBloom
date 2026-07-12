import { type QueryClient, type QueryKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../shared-kernel/supabase/client";
import type { Database } from "../../../shared-kernel/supabase/database.types";
import { enqueueOfflineMutation } from "../../sync/application/offlineOutbox";
import { buildMedicationDoseInsertOfflineMutation, buildMedicationDoseUpdateOfflineMutation } from "./medicationOfflineReplay";
import type { DoseRecord, DoseStatus } from "../domain/medication";
import { buildDoseRecordedAt, buildMedicationDoseInsertPayload, encodeMedicationDoseCareNote, mergeSavedDoseIntoList } from "./medicationDosePayload";
export { buildDoseRecordedAt, buildMedicationDoseInsertPayload, encodeMedicationDoseCareNote } from "./medicationDosePayload";
type DoseRow = Database["public"]["Tables"]["medication_doses"]["Row"];
type DoseUpdate = Database["public"]["Tables"]["medication_doses"]["Update"];
export type QuickMedicationDoseInput = { scheduleId?: string; doseDate?: string; scheduledTime?: string; conditionName?: string; medicationName: string; dosageLabel?: string; administeredAmount?: string; reactionNote?: string; status?: DoseStatus };
export type UpdateMedicationDoseInput = QuickMedicationDoseInput & { id: string; scheduledTime?: string };
type MedicationDoseCareNote = { version: 1; conditionName?: string; dosageLabel?: string; administeredAmount?: string; reactionNote?: string };
export const medicationDoseKeys = {
  today: (petId: string | null) => ["medication_doses", "today", petId] as const,
  range: (petId: string | null, fromDateKey: string, toDateKey: string) => ["medication_doses", "range", petId, fromDateKey, toDateKey] as const,
};
export function mapDoseRow(row: DoseRow): DoseRecord {
  const careNote = decodeMedicationDoseCareNote(row.reaction_note);
  return { id: row.id, petId: row.pet_id, scheduleId: row.schedule_id ?? undefined, doseDate: row.dose_date ?? undefined, medicationName: row.medication_name, conditionName: careNote.conditionName, dosageLabel: careNote.dosageLabel, administeredAmount: careNote.administeredAmount, scheduledAt: formatTime(row.scheduled_at), status: row.status, recordedAt: row.recorded_at ?? undefined, reactionNote: careNote.reactionNote };
}
export function nextDoseStatus(status: DoseStatus): DoseStatus {
  if (status === "pending") return "completed";
  if (status === "completed") return "partial";
  if (status === "partial") return "skipped";
  return "pending";
}
export function shouldCountDoseAsMedicationRecorded(status: DoseStatus) {
  return status !== "pending";
}
export function buildMedicationDoseUpdatePayload(input: UpdateMedicationDoseInput): DoseUpdate {
  const scheduledAt = buildScheduledAtForTime(input.scheduledTime);
  const payload: DoseUpdate = { medication_name: input.medicationName.trim() || "투약", reaction_note: encodeMedicationDoseCareNote(input), updated_at: new Date().toISOString() };

  if (scheduledAt) payload.scheduled_at = scheduledAt;
  if (input.status) {
    payload.status = input.status;
    payload.recorded_at = buildDoseRecordedAt(input.status);
  }

  return payload;
}
export function removeMedicationDoseFromList<T extends { id: string }>(doses: T[] | undefined, id: string) {
  return (doses ?? []).filter((dose) => dose.id !== id);
}
export function replaceMedicationDoseInList<T extends { id: string }>(doses: T[] | undefined, saved: T) {
  return (doses ?? []).map((dose) => (dose.id === saved.id ? saved : dose));
}
export function decodeMedicationDoseCareNote(value: string | null | undefined): Omit<MedicationDoseCareNote, "version"> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Partial<MedicationDoseCareNote>;
    if (parsed.version !== 1) return { reactionNote: value };
    return { conditionName: cleanOptional(parsed.conditionName), dosageLabel: cleanOptional(parsed.dosageLabel), administeredAmount: cleanOptional(parsed.administeredAmount), reactionNote: cleanOptional(parsed.reactionNote) };
  } catch {
    return { reactionNote: value };
  }
}
export function useTodayMedicationDoses(petId: string | null) {
  return useQuery({
    queryKey: medicationDoseKeys.today(petId),
    enabled: Boolean(supabase && petId),
    queryFn: async () => {
      if (!supabase || !petId) return [];
      const { start, end } = todayRange();
      return fetchMedicationDoses(petId, start, end, true);
    },
  });
}
export function useMedicationDosesByDateRange(petId: string | null, fromDateKey: string, toDateKey: string) {
  return useQuery({
    queryKey: medicationDoseKeys.range(petId, fromDateKey, toDateKey),
    enabled: Boolean(supabase && petId && fromDateKey && toDateKey),
    queryFn: async () => {
      if (!supabase || !petId) return [];
      const { start, end } = dateKeyRange(fromDateKey, toDateKey);
      return fetchMedicationDoses(petId, start, end, false);
    },
  });
}
export function useCreateMedicationDose(petId: string | null, userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: QuickMedicationDoseInput) => {
      if (!supabase || !petId || !userId) throw new Error("로그인이 필요합니다.");
      const status = input.status ?? "pending";
      const now = new Date();
      const payload = buildMedicationDoseInsertPayload({ ...input, petId, userId, now });
      const { data, error } = await supabase.from("medication_doses").insert(payload).select().single();
      if (error) {
        await enqueueOfflineMutation(buildMedicationDoseInsertOfflineMutation({ petId, userId, input: input as unknown as Record<string, unknown> }));
        throw new Error(error.message);
      }
      return mapDoseRow(data);
    },
    onMutate: async (input) => {
      const todayKey = medicationDoseKeys.today(petId);
      await queryClient.cancelQueries({ queryKey: todayKey });
      const previousToday = queryClient.getQueryData<DoseRecord[]>(todayKey);
      const status = input.status ?? "pending";
      const optimisticId = `dose-optimistic-${Date.now()}`;
      const scheduledAt = buildScheduledAtForDateTime(input.doseDate, input.scheduledTime, new Date());
      const dose: DoseRecord = { id: optimisticId, petId: petId ?? "pending-pet", scheduleId: input.scheduleId, doseDate: input.doseDate ?? localDateKey(scheduledAt), medicationName: input.medicationName.trim() || "투약", conditionName: cleanOptional(input.conditionName), dosageLabel: cleanOptional(input.dosageLabel), administeredAmount: cleanOptional(input.administeredAmount), scheduledAt: formatTime(scheduledAt.toISOString()), status, recordedAt: buildDoseRecordedAt(status) ?? undefined, reactionNote: cleanOptional(input.reactionNote) };
      queryClient.setQueryData<DoseRecord[]>(todayKey, (current) => mergeSavedDoseIntoList(current ?? [], dose));
      return { previousToday, optimisticId };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      const todayKey = medicationDoseKeys.today(petId);
      if (context.previousToday !== undefined) return void queryClient.setQueryData(todayKey, context.previousToday);
      const withoutOptimisticDose = (queryClient.getQueryData<DoseRecord[]>(todayKey) ?? []).filter((item) => item.id !== context.optimisticId);
      if (withoutOptimisticDose.length > 0) queryClient.setQueryData(todayKey, withoutOptimisticDose);
      else queryClient.removeQueries({ queryKey: todayKey, exact: true });
    },
    onSuccess: (dose, _input, context) => {
      queryClient.setQueryData<DoseRecord[]>(medicationDoseKeys.today(petId), (current) => mergeSavedDoseIntoList((current ?? []).filter((item) => item.id !== context?.optimisticId), dose));
      void queryClient.invalidateQueries({ queryKey: ["medication_doses"] });
    },
  });
}
export function useUpdateMedicationDose(petId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateMedicationDoseInput) => {
      if (!supabase || !petId) throw new Error("로그인이 필요합니다.");
      const { data, error } = await supabase.from("medication_doses").update(buildMedicationDoseUpdatePayload(input)).eq("id", input.id).eq("pet_id", petId).select().single();
      if (error) {
        await enqueueOfflineMutation(buildMedicationDoseUpdateOfflineMutation({ petId, input: input as unknown as Record<string, unknown> }));
        throw new Error(error.message);
      }
      return mapDoseRow(data);
    },
    onSuccess: (dose) => {
      replaceMedicationDoseInCachedLists(queryClient, petId, dose);
      void queryClient.invalidateQueries({ queryKey: ["medication_doses"] });
    },
  });
}
export function useDeleteMedicationDose(petId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase || !petId) throw new Error("로그인이 필요합니다.");
      const { data, error } = await supabase.from("medication_doses").delete().eq("id", id).eq("pet_id", petId).select().single();
      if (error) throw new Error(error.message);
      return mapDoseRow(data);
    },
    onSuccess: (dose) => {
      removeMedicationDoseFromCachedLists(queryClient, petId, dose.id);
      void queryClient.invalidateQueries({ queryKey: ["medication_doses"] });
    },
  });
}
export function useUpdateMedicationDoseStatus(petId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: DoseStatus }) => {
      if (!supabase) throw new Error("Supabase 클라이언트가 설정되어 있지 않습니다.");
      const { data, error } = await supabase
        .from("medication_doses")
        .update(buildDoseStatusUpdate(status))
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapDoseRow(data);
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: medicationDoseKeys.today(petId) });
      const previousToday = queryClient.getQueryData<DoseRecord[]>(medicationDoseKeys.today(petId));
      queryClient.setQueryData<DoseRecord[]>(medicationDoseKeys.today(petId), (current) =>
        (current ?? []).map((item) => (item.id === id ? { ...item, status, recordedAt: buildDoseRecordedAt(status) ?? undefined } : item)),
      );
      return { previousToday };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousToday) queryClient.setQueryData(medicationDoseKeys.today(petId), context.previousToday);
    },
    onSuccess: (dose) => {
      queryClient.setQueryData<DoseRecord[]>(medicationDoseKeys.today(petId), (current) =>
        (current ?? []).map((item) => (item.id === dose.id ? dose : item)),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["medication_doses"] });
    },
  });
}
function cleanOptional(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
async function fetchMedicationDoses(petId: string, start: string, end: string, ascending: boolean) {
  const { data, error } = await supabase!
    .from("medication_doses")
    .select("id,pet_id,schedule_id,dose_date,medication_name,scheduled_at,status,recorded_at,reaction_note,created_by,client_mutation_id,created_at,updated_at")
    .eq("pet_id", petId)
    .gte("scheduled_at", start)
    .lt("scheduled_at", end)
    .order("scheduled_at", { ascending });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapDoseRow);
}
function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}
function dateKeyRange(fromDateKey: string, toDateKey: string) {
  const start = parseDateKey(fromDateKey);
  const end = parseDateKey(toDateKey);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}
function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}
function buildScheduledAtForTime(scheduledTime?: string) {
  const timeMatch = scheduledTime?.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    const hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    if (hours <= 23 && minutes <= 59) {
      const scheduledAt = new Date();
      scheduledAt.setHours(hours, minutes, 0, 0);
      return scheduledAt.toISOString();
    }
  }
  return undefined;
}
function buildScheduledAtForDateTime(doseDate?: string, scheduledTime?: string, fallback = new Date()) {
  const scheduledAt = new Date(fallback);
  if (doseDate) {
    const [year, month, day] = doseDate.split("-").map(Number);
    scheduledAt.setFullYear(year ?? scheduledAt.getFullYear(), (month ?? scheduledAt.getMonth() + 1) - 1, day ?? scheduledAt.getDate());
  }
  const timeMatch = scheduledTime?.match(/^(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    scheduledAt.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
  }
  return scheduledAt;
}
function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function buildDoseStatusUpdate(status: DoseStatus) {
  const now = new Date();
  return { status, recorded_at: buildDoseRecordedAt(status, now), updated_at: now.toISOString() };
}
function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}
function removeMedicationDoseFromCachedLists(queryClient: QueryClient, petId: string | null, id: string) {
  for (const [queryKey, current] of queryClient.getQueriesData<DoseRecord[]>({ queryKey: ["medication_doses"] })) {
    if (Array.isArray(current) && isMedicationDoseListCacheForPet(queryKey, petId)) queryClient.setQueryData<DoseRecord[]>(queryKey, removeMedicationDoseFromList(current, id));
  }
}
function replaceMedicationDoseInCachedLists(queryClient: QueryClient, petId: string | null, saved: DoseRecord) {
  for (const [queryKey, current] of queryClient.getQueriesData<DoseRecord[]>({ queryKey: ["medication_doses"] })) {
    if (Array.isArray(current) && isMedicationDoseListCacheForPet(queryKey, petId)) queryClient.setQueryData<DoseRecord[]>(queryKey, replaceMedicationDoseInList(current, saved));
  }
}
function isMedicationDoseListCacheForPet(queryKey: QueryKey, petId: string | null) {
  return queryKey[0] === "medication_doses" && (queryKey[1] === "today" || queryKey[1] === "range") && queryKey[2] === petId;
}
