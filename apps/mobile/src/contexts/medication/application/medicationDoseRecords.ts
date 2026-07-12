import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../shared-kernel/supabase/client";
import type { Database } from "../../../shared-kernel/supabase/database.types";
import { isRetriableOfflineError, offlineErrorMessage } from "../../sync/application/offlineErrorPolicy";
import { createClientMutationId } from "../../sync/application/offlineMutationPayload";
import type { DoseRecord, DoseStatus } from "../domain/medication";
import { buildDoseRecordedAt, buildMedicationDoseInsertPayload, decodeMedicationDoseCareNote, encodeMedicationDoseCareNote, mergeSavedDoseIntoList } from "./medicationDosePayload";
import { localDateKey, useCurrentLocalDateKey } from "./medicationDoseDate";
import { findMedicationDoseInCachedLists, removeMedicationDoseFromCachedLists, replaceMedicationDoseInCachedLists } from "./medicationDoseCache";
import { enqueueMedicationDoseInsert, enqueueMedicationDoseUpdate } from "./medicationDoseOfflineQueue";
import { deleteMedicationDoseWithRetry } from "./medicationDoseDeletion";
export { buildDoseRecordedAt, buildMedicationDoseInsertPayload, decodeMedicationDoseCareNote, encodeMedicationDoseCareNote } from "./medicationDosePayload";
export { removeMedicationDoseFromList, replaceMedicationDoseInList } from "./medicationDoseCache";
type DoseRow = Database["public"]["Tables"]["medication_doses"]["Row"];
type DoseUpdate = Database["public"]["Tables"]["medication_doses"]["Update"];
export type QuickMedicationDoseInput = { scheduleId?: string; doseDate?: string; scheduledTime?: string; conditionName?: string; medicationName: string; dosageLabel?: string; administeredAmount?: string; reactionNote?: string; status?: DoseStatus };
export type UpdateMedicationDoseInput = QuickMedicationDoseInput & { id: string; scheduledTime?: string };
export const medicationDoseKeys = {
  today: (petId: string | null, dateKey = localDateKey(), userId: string | null = null) => ["medication_doses", "today", petId, dateKey, userId] as const,
  range: (petId: string | null, fromDateKey: string, toDateKey: string, userId: string | null = null) => ["medication_doses", "range", petId, fromDateKey, toDateKey, userId] as const,
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
export function buildMedicationDoseUpdatePayload(input: UpdateMedicationDoseInput, clientMutationId?: string): DoseUpdate {
  const scheduledAt = buildScheduledAtForTime(input.scheduledTime);
  const payload: DoseUpdate = { medication_name: input.medicationName.trim() || "투약", reaction_note: encodeMedicationDoseCareNote(input), updated_at: new Date().toISOString() };

  if (clientMutationId) payload.client_mutation_id = clientMutationId;
  if (scheduledAt) payload.scheduled_at = scheduledAt;
  if (input.status) {
    payload.status = input.status;
    payload.recorded_at = buildDoseRecordedAt(input.status);
  }

  return payload;
}
export function useTodayMedicationDoses(petId: string | null, userId: string | null = null) {
  const todayDateKey = useCurrentLocalDateKey();
  return useQuery({
    queryKey: medicationDoseKeys.today(petId, todayDateKey, userId),
    enabled: Boolean(supabase && petId && userId),
    queryFn: async () => {
      if (!supabase || !petId) return [];
      return fetchMedicationDoses(petId, { fromDateKey: todayDateKey, toDateKey: todayDateKey, ascending: true });
    },
  });
}
export function useMedicationDosesByDateRange(petId: string | null, fromDateKey: string, toDateKey: string, userId: string | null = null) {
  return useQuery({
    queryKey: medicationDoseKeys.range(petId, fromDateKey, toDateKey, userId),
    enabled: Boolean(supabase && petId && userId && fromDateKey && toDateKey),
    queryFn: async () => {
      if (!supabase || !petId) return [];
      return fetchMedicationDoses(petId, { fromDateKey, toDateKey, ascending: false });
    },
  });
}
export function useCreateMedicationDose(petId: string | null, userId: string | null) {
  const queryClient = useQueryClient();
  const todayDateKey = useCurrentLocalDateKey();
  return useMutation({
    mutationFn: async (input: QuickMedicationDoseInput) => {
      if (!supabase || !petId || !userId) throw new Error("로그인이 필요합니다.");
      const clientMutationId = createClientMutationId();
      const now = new Date();
      const payload = buildMedicationDoseInsertPayload({ ...input, petId, userId, now, clientMutationId });
      try {
        const { data, error } = await supabase.from("medication_doses").insert(payload).select().single();
        if (error) {
          if (!isRetriableOfflineError(error)) throw new Error(error.message);
          const dose = await enqueueMedicationDoseInsert({ petId, userId, formInput: { ...input }, insertPayload: payload, clientMutationId });
          return { dose, queued: true };
        }
        return { dose: mapDoseRow(data), queued: false };
      } catch (error) {
        if (!isRetriableOfflineError(error)) throw new Error(offlineErrorMessage(error));
        const dose = await enqueueMedicationDoseInsert({ petId, userId, formInput: { ...input }, insertPayload: payload, clientMutationId });
        return { dose, queued: true };
      }
    },
    onMutate: async (input) => {
      const todayKey = medicationDoseKeys.today(petId, todayDateKey, userId);
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
      const todayKey = medicationDoseKeys.today(petId, todayDateKey, userId);
      if (context.previousToday !== undefined) return void queryClient.setQueryData(todayKey, context.previousToday);
      const withoutOptimisticDose = (queryClient.getQueryData<DoseRecord[]>(todayKey) ?? []).filter((item) => item.id !== context.optimisticId);
      if (withoutOptimisticDose.length > 0) queryClient.setQueryData(todayKey, withoutOptimisticDose);
      else queryClient.removeQueries({ queryKey: todayKey, exact: true });
    },
    onSuccess: (result, _input, context) => {
      queryClient.setQueryData<DoseRecord[]>(medicationDoseKeys.today(petId, todayDateKey, userId), (current) => mergeSavedDoseIntoList((current ?? []).filter((item) => item.id !== context?.optimisticId), result.dose));
      if (!result.queued) void queryClient.invalidateQueries({ queryKey: ["medication_doses"] });
    },
  });
}
export function useUpdateMedicationDose(petId: string | null, userId: string | null = null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateMedicationDoseInput) => {
      if (!supabase || !petId) throw new Error("로그인이 필요합니다.");
      const clientMutationId = createClientMutationId();
      const updatePayload = buildMedicationDoseUpdatePayload(input, clientMutationId);
      const currentDose = findMedicationDoseInCachedLists(queryClient, petId, userId, input.id);
      try {
        const { data, error } = await supabase.from("medication_doses").update(updatePayload).eq("id", input.id).eq("pet_id", petId).select().single();
        if (error) {
          if (!isRetriableOfflineError(error)) throw new Error(error.message);
          if (!currentDose) throw new Error("오프라인 수정 원본을 찾지 못했습니다.");
          const dose = await enqueueMedicationDoseUpdate({ petId, formInput: { ...input }, updatePayload: { ...updatePayload }, clientMutationId, currentDose });
          return { dose, queued: true };
        }
        return { dose: mapDoseRow(data), queued: false };
      } catch (error) {
        if (!isRetriableOfflineError(error)) throw new Error(offlineErrorMessage(error));
        if (!currentDose) throw new Error("오프라인 수정 원본을 찾지 못했습니다.");
        const dose = await enqueueMedicationDoseUpdate({ petId, formInput: { ...input }, updatePayload: { ...updatePayload }, clientMutationId, currentDose });
        return { dose, queued: true };
      }
    },
    onSuccess: (result) => {
      replaceMedicationDoseInCachedLists(queryClient, petId, userId, result.dose);
      if (!result.queued) void queryClient.invalidateQueries({ queryKey: ["medication_doses"] });
    },
  });
}
export function useDeleteMedicationDose(petId: string | null, userId: string | null = null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase || !petId) throw new Error("로그인이 필요합니다.");
      const data = await deleteMedicationDoseWithRetry(supabase, petId, id);
      return { id, dose: data ? mapDoseRow(data) : null };
    },
    onSuccess: (result) => {
      removeMedicationDoseFromCachedLists(queryClient, petId, userId, result.id);
      void queryClient.invalidateQueries({ queryKey: ["medication_doses"] });
    },
  });
}
export function useUpdateMedicationDoseStatus(petId: string | null, userId: string | null = null) {
  const queryClient = useQueryClient();
  const todayDateKey = useCurrentLocalDateKey();
  const todayKey = medicationDoseKeys.today(petId, todayDateKey, userId);
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: DoseStatus }) => {
      if (!supabase || !petId) throw new Error("Supabase 클라이언트가 설정되어 있지 않습니다.");
      const clientMutationId = createClientMutationId();
      const updatePayload = buildDoseStatusUpdate(status, clientMutationId);
      const currentDose = findMedicationDoseInCachedLists(queryClient, petId, userId, id);
      try {
        const { data, error } = await supabase.from("medication_doses").update(updatePayload).eq("id", id).eq("pet_id", petId).select().single();
        if (error) {
          if (!isRetriableOfflineError(error)) throw new Error(error.message);
          if (!currentDose) throw new Error("오프라인 투약 원본을 찾지 못했습니다.");
          const dose = await enqueueMedicationDoseUpdate({ petId, formInput: { id, status }, updatePayload, clientMutationId, currentDose });
          return { dose, queued: true };
        }
        return { dose: mapDoseRow(data), queued: false };
      } catch (error) {
        if (!isRetriableOfflineError(error)) throw new Error(offlineErrorMessage(error));
        if (!currentDose) throw new Error("오프라인 투약 원본을 찾지 못했습니다.");
        const dose = await enqueueMedicationDoseUpdate({ petId, formInput: { id, status }, updatePayload, clientMutationId, currentDose });
        return { dose, queued: true };
      }
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: todayKey });
      const previousToday = queryClient.getQueryData<DoseRecord[]>(todayKey);
      queryClient.setQueryData<DoseRecord[]>(todayKey, (current) =>
        (current ?? []).map((item) => (item.id === id ? { ...item, status, recordedAt: buildDoseRecordedAt(status) ?? undefined } : item)),
      );
      return { previousToday };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousToday) queryClient.setQueryData(todayKey, context.previousToday);
    },
    onSuccess: (result) => {
      queryClient.setQueryData<DoseRecord[]>(todayKey, (current) =>
        (current ?? []).map((item) => (item.id === result.dose.id ? result.dose : item)),
      );
    },
    onSettled: (result) => {
      if (!result?.queued) void queryClient.invalidateQueries({ queryKey: ["medication_doses"] });
    },
  });
}
function cleanOptional(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
async function fetchMedicationDoses(petId: string, input: { fromDateKey: string; toDateKey: string; ascending: boolean }) {
  const { data, error } = await supabase!
    .from("medication_doses")
    .select("id,pet_id,schedule_id,dose_date,medication_name,scheduled_at,status,recorded_at,reaction_note,created_by,client_mutation_id,created_at,updated_at")
    .eq("pet_id", petId)
    .gte("dose_date", input.fromDateKey)
    .lte("dose_date", input.toDateKey)
    .order("scheduled_at", { ascending: input.ascending });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapDoseRow);
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
function buildDoseStatusUpdate(status: DoseStatus, clientMutationId: string) {
  const now = new Date();
  return { status, recorded_at: buildDoseRecordedAt(status, now), client_mutation_id: clientMutationId, updated_at: now.toISOString() };
}
function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}
