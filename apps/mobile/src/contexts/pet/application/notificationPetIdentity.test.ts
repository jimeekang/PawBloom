declare const require: (name: string) => any;
const modules = require("node:module"), original = modules._load;
let failure: "none" | "error" | "throw" = "none", missingPet = false;
const queried: string[] = [];
let petCreatedAt = "pet-original", scheduleCreatedAt = "schedule-original", active = true, belongs = true;
const database = { from: (table: string) => {
  queried.push(table);
  const filters: Record<string, string> = {};
  const result = () => table === "pets" ? missingPet ? null : { id: "a", created_at: petCreatedAt } : table === "medication_schedules" ? belongs ? { id: "s", pet_id: "a", created_at: scheduleCreatedAt, medication_id: "m", starts_on: "2026-10-19", ends_on: "2026-10-25", recurrence_interval_days: 2 } : null : table === "medications" ? { condition_id: "c" } : table === "conditions" ? active && filters.status === "active" ? { id: "c" } : null : null;
  const builder: any = { select: () => builder, eq: (key: string, value: string) => { filters[key] = value; return builder; }, maybeSingle: async () => { if (failure === "throw") throw new Error("offline"); return { data: result(), error: failure === "error" ? new Error("server") : null }; }, then: (resolve: any) => resolve({ data: result() ? [result()] : [], error: null }) }; return builder;
} };
modules._load = function(name: string, parent: unknown, main: boolean) { return name.endsWith("/supabase/client") ? { supabase: database } : original.call(this, name, parent, main); };
try {
  const { validateNotificationIdentity } = require("./notificationPetIdentity"), target = { petId: "a", petCreatedAt: "pet-original", scheduleId: "s", scheduleCreatedAt: "schedule-original", dateKey: "2026-10-21" };
  assert(await validateNotificationIdentity(target) === "valid", "fresh identity and applicable schedule can open");
  assert(await validateNotificationIdentity({ ...target, dateKey: "2026-10-20" }) === "rejected", "recurrence date must apply");
  assert(await validateNotificationIdentity({ ...target, dateKey: "2026-10-27" }) === "rejected", "expired schedule cannot open");
  petCreatedAt = "reused"; assert(await validateNotificationIdentity(target) === "rejected", "same pet ID with new creation identity rejected"); petCreatedAt = "pet-original";
  scheduleCreatedAt = "reused"; assert(await validateNotificationIdentity(target) === "rejected", "same schedule ID with new incarnation rejected"); scheduleCreatedAt = "schedule-original";
  active = false; assert(await validateNotificationIdentity(target) === "rejected", "resolved/archived care condition cannot open"); active = true;
  belongs = false; assert(await validateNotificationIdentity(target) === "rejected", "schedule absent from pet cannot open");
  belongs = true; failure = "error"; assert(await validateNotificationIdentity(target) === "unavailable", "server errors are temporary, not deletion");
  failure = "throw"; assert(await validateNotificationIdentity(target) === "unavailable", "network throws are temporary");
  failure = "none"; missingPet = true; assert(await validateNotificationIdentity(target) === "rejected", "confirmed missing pet is rejected"); missingPet = false;
  queried.length = 0;
  assert(await validateNotificationIdentity({ ...target, scheduleId: undefined }) === "valid" && queried.join() === "pets", "meal validation never depends on medication queries");
} finally { modules._load = original; }
function assert(value: unknown, message: string): void { if (!value) throw new Error(message); }
export {};
