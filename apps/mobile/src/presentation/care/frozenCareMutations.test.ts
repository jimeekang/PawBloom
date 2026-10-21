import { createHookHarness } from "../testHookHarness";
declare const require: (name: string) => any;
const modules = require("node:module"), originalLoad = modules._load, react = require("react"), query = require("@tanstack/react-query");
const client = new query.QueryClient({ defaultOptions: { mutations: { retry: false, networkMode: "always" } } });
let harness = createHookHarness(), petId = "a", userId = "u", dateKey = "2026-10-20";
const queuedMutations: any[] = [];
const requests: Array<{ payload: any; resolve: (value: any) => void; reject: (error: unknown) => void }> = [];
const database = { from: () => ({ insert: (payload: any) => ({ select: () => ({ single: () => new Promise((resolve, reject) => requests.push({ payload, resolve, reject })) }) }) }) };
modules._load = function(name: string, parent: unknown, main: boolean) {
  if (name === "react") return { ...react, ...Object.fromEntries(Object.keys(harness.hooks).map((key) => [key, (...args: any[]) => (harness.hooks as any)[key](...args)])) };
  if (name.endsWith("/offlineOutbox")) return { enqueueOfflineMutation: async (mutation: any) => { queuedMutations.push(mutation); } };
  if (name.endsWith("/notificationPetIdentity")) throw new Error("saving must not read notification identity");
  if (name.endsWith("/supabase/client")) return { supabase: database };
  if (name.endsWith("/medicationDoseDate")) return { localDateKey: (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`, useCurrentLocalDateKey: () => dateKey };
  if (name === "@tanstack/react-query") return { ...query, useQueryClient: () => client, useMutation: (options: any) => {
    const reference = harness.hooks.useRef(null);
    if (!reference.current) reference.current = new query.MutationObserver(client, options);
    reference.current.setOptions(options);
    harness.hooks.useEffect(() => reference.current.subscribe(() => undefined), []);
    return { ...reference.current.getCurrentResult(), mutate: (input: any, callbacks: any) => { void reference.current.mutate(input, callbacks).catch(() => undefined); }, mutateAsync: (input: any, callbacks: any) => reference.current.mutate(input, callbacks) };
  } };
  return originalLoad.call(this, name, parent, main);
};
try {
  const { useCreateMedicationDose, medicationDoseKeys } = require("../../contexts/medication/application/medicationDoseRecords");
  const { updatePetMutationAccess } = require("../../contexts/pet/application/petMutationTarget");
  const { useShellMutationScope } = require("../shell/useShellMutationScope");
  let notices = 0, callSuccess = 0;
  const render = () => harness.render(() => { const scope = useShellMutationScope(`${userId}:${petId}`); return { mutation: useCreateMedicationDose(petId, userId), notice: scope.guard(() => { notices++; }) }; });
  updatePetMutationAccess(userId, ["a", "b"], client);
  client.setQueryData(medicationDoseKeys.today("b", dateKey, userId), [{ id: "b-only", petId: "b", doseDate: dateKey }]);
  let result = render();
  const firstNotice = result.notice;
  const first = result.mutation.mutateAsync({ medicationName: "A", scheduleId: "schedule", doseDate: "2026-10-19", status: "completed" }, { onSuccess: firstNotice });
  const duplicate = result.mutation.mutateAsync({ medicationName: "A", scheduleId: "schedule", doseDate: "2026-10-19", status: "completed" });
  await flush(); assert(requests.length === 1, "same schedule/date concurrently inserts once");
  const payload = requests[0]!.payload;
  assert(payload.pet_id === "a" && payload.created_by === "u" && payload.dose_date === "2026-10-19" && payload.client_mutation_id, "pet/date/mutation fixed before await");
  petId = "b"; result = render(); requests[0]!.resolve({ data: row(payload, "saved-a"), error: null }); await Promise.all([first, duplicate]);
  assert(client.getQueryData(medicationDoseKeys.today("b", dateKey, userId))[0].id === "b-only", "late A result never changes B cache");
  const aRows = client.getQueryData(medicationDoseKeys.today("a", "2026-10-19", userId));
  assert(aRows.length === 1 && aRows[0].id === "saved-a" && notices === 0, "shared promise removes each optimistic row; old A UI callback blocked");
  petId = "a"; result = render(); firstNotice(); assert(notices === 0, "A→B→A never revives prior UI callback");
  const existing = await result.mutation.mutateAsync({ medicationName: "A", scheduleId: "schedule", doseDate: "2026-10-19", status: "completed" });
  assert(existing.dose.id === "saved-a" && requests.length === 1, "existing schedule/date cannot insert another completion");
  const revoked = result.mutation.mutateAsync({ medicationName: "A", scheduleId: "schedule", doseDate: "2026-10-18" }, { onSuccess: () => { callSuccess++; }, onSettled: () => { callSuccess++; } });
  await flush(); updatePetMutationAccess(userId, ["b"], client); updatePetMutationAccess(userId, ["a", "b"], client);
  requests[1]!.resolve({ data: row(requests[1]!.payload, "revoked"), error: null }); await revoked;
  assert(callSuccess === 0 && !client.getQueryData(medicationDoseKeys.today("a", "2026-10-18", userId)), "revocation/restore ignores late response and cannot resurrect cache");
  result = render(); const switched = result.mutation.mutateAsync({ medicationName: "A" }, { onError: () => { callSuccess++; }, onSettled: () => { callSuccess++; } }).catch(() => undefined); await flush();
  userId = "other"; updatePetMutationAccess(userId, ["a"], client); render(); requests[2]!.resolve({ error: { code: "23514", message: "forced error" }, data: null }); await switched;
  assert(callSuccess === 0 && !client.getQueryData(medicationDoseKeys.today("a", dateKey, "u")), "account-switch rejection cannot rollback or callback into new account");
  result = render();
  const offline = result.mutation.mutateAsync({ medicationName: "Offline dose", scheduleId: "new-unsynced", doseDate: "2026-10-21", status: "completed" }); await flush();
  requests[3]!.resolve({ data: null, error: { message: "Network request failed" } });
  const savedOffline = await offline;
  assert(savedOffline.queued && queuedMutations.length === 1 && savedOffline.dose.petId === "a" && savedOffline.dose.doseDate === "2026-10-21", "actual create hook preserves retriable insert→local enqueue with frozen pet/date");
  assert(client.getQueryData(medicationDoseKeys.today("a", "2026-10-21", "other"))[0].id === savedOffline.dose.id, "queued dose remains in the correct account cache");
  harness.unmount(); client.clear();
} finally { modules._load = originalLoad; }
function row(payload: any, id: string) { return { ...payload, id, scheduled_at: payload.scheduled_at, reaction_note: payload.reaction_note ?? null }; }
async function flush() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
