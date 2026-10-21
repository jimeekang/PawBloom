import { supabase } from "../../../shared-kernel/supabase/client";
export type NotificationPetIdentity = { petCreatedAt: string; schedules: Record<string, string> };
export type NotificationIdentityValidation = "valid" | "unavailable" | "rejected";
/** Optional scheduling enrichment. Failure never means that local reminders must stop. */
export async function fetchNotificationPetIdentity(petId: string): Promise<NotificationPetIdentity | null> {
  if (!supabase) return null;
  try {
    const [pet, schedules] = await Promise.all([
      supabase.from("pets").select("id,created_at").eq("id", petId).maybeSingle(),
      supabase.from("medication_schedules").select("id,created_at").eq("pet_id", petId),
    ]);
    if (pet.error || !pet.data) return null;
    return { petCreatedAt: pet.data.created_at, schedules: Object.fromEntries((schedules.error ? [] : schedules.data ?? []).map((row) => [row.id, row.created_at])) };
  } catch { return null; }
}
/** Fresh RLS reads distinguish temporary unavailability from confirmed identity/access mismatch. */
export async function validateNotificationIdentity(target: { petId: string; petCreatedAt: string; scheduleId?: string; scheduleCreatedAt?: string; dateKey: string }): Promise<NotificationIdentityValidation> {
  if (!supabase) return "unavailable";
  try {
    const pet = await supabase.from("pets").select("id,created_at").eq("id", target.petId).maybeSingle();
    if (pet.error) return "unavailable";
    if (!pet.data || pet.data.created_at !== target.petCreatedAt) return "rejected";
    if (!target.scheduleId) return "valid";
    const { data, error } = await supabase.from("medication_schedules").select("created_at,medication_id,starts_on,ends_on,recurrence_interval_days").eq("id", target.scheduleId).eq("pet_id", target.petId).maybeSingle();
    if (error) return "unavailable";
    if (!data || data.created_at !== target.scheduleCreatedAt) return "rejected";
    const medication = await supabase.from("medications").select("condition_id").eq("id", data.medication_id).eq("pet_id", target.petId).maybeSingle();
    if (medication.error) return "unavailable";
    if (!medication.data) return "rejected";
    if (medication.data.condition_id) {
      const condition = await supabase.from("conditions").select("id").eq("id", medication.data.condition_id).eq("pet_id", target.petId).eq("status", "active").maybeSingle();
      if (condition.error) return "unavailable";
      if (!condition.data) return "rejected";
    }
    return data.starts_on <= target.dateKey && (!data.ends_on || data.ends_on >= target.dateKey) && Math.round((Date.parse(target.dateKey) - Date.parse(data.starts_on)) / 86400000) % Math.max(1, Math.floor(data.recurrence_interval_days || 1)) === 0 ? "valid" : "rejected";
  } catch { return "unavailable"; }
}
