import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../shared-kernel/supabase/client";
import type { Database } from "../../../shared-kernel/supabase/database.types";
import type { DoseRecord, DoseStatus } from "../domain/medication";

type DoseRow = Database["public"]["Tables"]["medication_doses"]["Row"];
type DoseInsert = Database["public"]["Tables"]["medication_doses"]["Insert"];

export type QuickMedicationDoseInput = {
  conditionName?: string;
  medicationName: string;
  dosageLabel?: string;
  administeredAmount?: string;
  reactionNote?: string;
  status?: DoseStatus;
};

type MedicationDoseCareNote = {
  version: 1;
  conditionName?: string;
  dosageLabel?: string;
  administeredAmount?: string;
  reactionNote?: string;
};

export const medicationDoseKeys = {
  today: (petId: string | null) => ["medication_doses", "today", petId] as const,
  range: (petId: string | null, fromDateKey: string, toDateKey: string) => ["medication_doses", "range", petId, fromDateKey, toDateKey] as const,
};

export function mapDoseRow(row: DoseRow): DoseRecord {
  const careNote = decodeMedicationDoseCareNote(row.reaction_note);

  return {
    id: row.id,
    petId: row.pet_id,
    medicationName: row.medication_name,
    conditionName: careNote.conditionName,
    dosageLabel: careNote.dosageLabel,
    administeredAmount: careNote.administeredAmount,
    scheduledAt: formatTime(row.scheduled_at),
    status: row.status,
    recordedAt: row.recorded_at ?? undefined,
    reactionNote: careNote.reactionNote,
  };
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

export function buildDoseRecordedAt(status: DoseStatus, recordedAt = new Date()) {
  return status === "pending" ? null : recordedAt.toISOString();
}

export function encodeMedicationDoseCareNote(input: QuickMedicationDoseInput): string | null {
  const careNote: MedicationDoseCareNote = {
    version: 1,
    conditionName: cleanOptional(input.conditionName),
    dosageLabel: cleanOptional(input.dosageLabel),
    administeredAmount: cleanOptional(input.administeredAmount),
    reactionNote: cleanOptional(input.reactionNote),
  };

  if (!careNote.conditionName && !careNote.dosageLabel && !careNote.administeredAmount && !careNote.reactionNote) {
    return null;
  }

  return JSON.stringify(careNote);
}

export function decodeMedicationDoseCareNote(value: string | null | undefined): Omit<MedicationDoseCareNote, "version"> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as Partial<MedicationDoseCareNote>;
    if (parsed.version !== 1) {
      return { reactionNote: value };
    }

    return {
      conditionName: cleanOptional(parsed.conditionName),
      dosageLabel: cleanOptional(parsed.dosageLabel),
      administeredAmount: cleanOptional(parsed.administeredAmount),
      reactionNote: cleanOptional(parsed.reactionNote),
    };
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
      if (!supabase || !petId || !userId) {
        throw new Error("로그인이 필요합니다.");
      }

      const status = input.status ?? "pending";
      const now = new Date();
      const payload: DoseInsert = {
        pet_id: petId,
        created_by: userId,
        medication_name: input.medicationName.trim() || "투약",
        scheduled_at: now.toISOString(),
        status,
        recorded_at: buildDoseRecordedAt(status, now),
        reaction_note: encodeMedicationDoseCareNote(input),
      };

      const { data, error } = await supabase.from("medication_doses").insert(payload).select().single();
      if (error) throw new Error(error.message);
      return mapDoseRow(data);
    },
    onMutate: async (input) => {
      const todayKey = medicationDoseKeys.today(petId);
      await queryClient.cancelQueries({ queryKey: todayKey });
      const previousToday = queryClient.getQueryData<DoseRecord[]>(todayKey);
      const status = input.status ?? "pending";
      const optimisticId = `dose-optimistic-${Date.now()}`;
      const dose: DoseRecord = { id: optimisticId, petId: petId ?? "pending-pet", medicationName: input.medicationName.trim() || "투약", conditionName: cleanOptional(input.conditionName), dosageLabel: cleanOptional(input.dosageLabel), administeredAmount: cleanOptional(input.administeredAmount), scheduledAt: formatTime(new Date().toISOString()), status, recordedAt: buildDoseRecordedAt(status) ?? undefined, reactionNote: cleanOptional(input.reactionNote) };
      queryClient.setQueryData<DoseRecord[]>(todayKey, (current) => [dose, ...(current ?? [])]);
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
      queryClient.setQueryData<DoseRecord[]>(medicationDoseKeys.today(petId), (current) => [dose, ...(current ?? []).filter((item) => item.id !== dose.id && item.id !== context?.optimisticId)]);
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
    .select("id,pet_id,schedule_id,medication_name,scheduled_at,status,recorded_at,reaction_note,created_by,client_mutation_id,created_at,updated_at")
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

function buildDoseStatusUpdate(status: DoseStatus) {
  const now = new Date();
  return { status, recorded_at: buildDoseRecordedAt(status, now), updated_at: now.toISOString() };
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}
