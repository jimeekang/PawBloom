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
      if (!supabase || !petId) {
        return [];
      }

      const { start, end } = todayRange();
      const { data, error } = await supabase
        .from("medication_doses")
        .select("id,pet_id,schedule_id,medication_name,scheduled_at,status,recorded_at,reaction_note,created_by,client_mutation_id,created_at,updated_at")
        .eq("pet_id", petId)
        .gte("scheduled_at", start)
        .lt("scheduled_at", end)
        .order("scheduled_at", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      return (data ?? []).map(mapDoseRow);
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
      const payload: DoseInsert = {
        pet_id: petId,
        created_by: userId,
        medication_name: input.medicationName.trim() || "투약",
        scheduled_at: new Date().toISOString(),
        status,
        recorded_at: status === "pending" ? null : new Date().toISOString(),
        reaction_note: encodeMedicationDoseCareNote(input),
      };

      const { data, error } = await supabase.from("medication_doses").insert(payload).select().single();
      if (error) {
        throw new Error(error.message);
      }

      return mapDoseRow(data);
    },
    onSuccess: (dose) => {
      queryClient.setQueryData<DoseRecord[]>(medicationDoseKeys.today(petId), (current) => [dose, ...(current ?? [])]);
      void queryClient.invalidateQueries({ queryKey: medicationDoseKeys.today(petId) });
    },
  });
}

export function useUpdateMedicationDoseStatus(petId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: DoseStatus }) => {
      if (!supabase) {
        throw new Error("Supabase 클라이언트가 설정되어 있지 않습니다.");
      }

      const { data, error } = await supabase
        .from("medication_doses")
        .update({
          status,
          recorded_at: status === "pending" ? null : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return mapDoseRow(data);
    },
    onSuccess: (dose) => {
      queryClient.setQueryData<DoseRecord[]>(medicationDoseKeys.today(petId), (current) =>
        (current ?? []).map((item) => (item.id === dose.id ? dose : item)),
      );
      void queryClient.invalidateQueries({ queryKey: medicationDoseKeys.today(petId) });
    },
  });
}

function cleanOptional(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}
