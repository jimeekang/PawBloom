declare const require: (name: string) => any;
const modules = require("node:module"), original = modules._load;
let pending: any[] = [], medicationRows: any[] = [], diaryRows: any[] = [];
const database = { from: (table: string) => {
  const builder: any = { select: () => builder, in: () => builder, range: () => builder, eq: () => builder, gte: () => builder, lte: () => builder, is: () => builder, order: () => builder, then: (resolve: any) => resolve({ data: table === "medication_doses" ? medicationRows : diaryRows, error: null }) }; return builder;
} };
modules._load = function(name: string, parent: unknown, main: boolean) {
  if (name.endsWith("/supabase/client")) return { supabase: database };
  if (name.endsWith("/offlineOutbox")) return { listPendingMutations: async () => pending };
  return original.call(this, name, parent, main);
};
try {
  const { QueryClient, QueryObserver } = require("@tanstack/react-query"), client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const { fetchMedicationDoses, medicationDoseKeys } = require("../../contexts/medication/application/medicationDoseRecords"), { fetchDiaryEntries, diaryKeys } = require("../../contexts/diary/application/diaryRecords");
  const { buildMedicationDoseInsertOfflineMutation } = require("../../contexts/medication/application/medicationOfflineReplay"), { buildDiaryInsertOfflineMutation } = require("../../contexts/diary/application/diaryOfflineReplay");
  const { fetchDiaryMemories } = require("../../contexts/diary/application/diaryMemories");
  const { invalidateTodayCare } = require("../../contexts/pet/application/todayCareInvalidation");
  const dateKey = "2026-10-20", insert = { pet_id: "a", created_by: "u", schedule_id: "s", dose_date: dateKey, medication_name: "Queued med", scheduled_at: "2026-10-20T08:00:00Z", status: "completed", recorded_at: "2026-10-20T08:00:00Z", reaction_note: null, client_mutation_id: "dose-mutation" };
  pending = [
    { ...buildMedicationDoseInsertOfflineMutation({ petId: "a", userId: "u", input: {}, insertPayload: insert, clientMutationId: "dose-mutation" }), queuedByUserId: "u" },
    { ...buildDiaryInsertOfflineMutation({ petId: "a", userId: "u", input: { category: "memo", summary: "Queued memo", entryDate: dateKey }, clientMutationId: "diary-mutation" }), queuedByUserId: "u" },
  ];
  const doseKey = medicationDoseKeys.today("a", dateKey, "u"), diaryKey = diaryKeys.date("a", dateKey, "u");
  const doseObserver = new QueryObserver(client, { queryKey: doseKey, queryFn: () => fetchMedicationDoses("a", { fromDateKey: dateKey, toDateKey: dateKey, ascending: true }, "u") });
  const diaryObserver = new QueryObserver(client, { queryKey: diaryKey, queryFn: () => fetchDiaryEntries("a", dateKey, dateKey, "u") });
  const unsubscribeDose = doseObserver.subscribe(() => undefined), unsubscribeDiary = diaryObserver.subscribe(() => undefined);
  await Promise.all([doseObserver.refetch(), diaryObserver.refetch()]);
  assert(client.getQueryData(doseKey).length === 1 && client.getQueryData(diaryKey).length === 1, "active queries expose both durable pending records");
  await invalidateTodayCare(client, "u", true); await invalidateTodayCare(client, "u", false);
  assert(client.getQueryData(doseKey)[0].status === "completed" && client.getQueryData(diaryKey)[0].summary === "Queued memo", "B's successful routine/diary save cannot erase A's queued dose/diary on active refetch");
  assert((await fetchMedicationDoses("a", { fromDateKey: dateKey, toDateKey: dateKey, ascending: true }, "other")).length === 0 && (await fetchDiaryEntries("a", dateKey, dateKey, "other")).length === 0, "foreign account cannot overlay this outbox");
  assert((await fetchDiaryMemories("a", database, "u")).length === 1 && (await fetchDiaryMemories("a", database, "other")).length === 0, "memories read path also overlays queued diary and excludes foreign pending records");
  medicationRows = [{ ...insert, id: "server-dose" }]; diaryRows = [{ id: "server-diary", pet_id: "a", category: "memo", record_origin: "diary", entry_date: dateKey, occurred_at: "2026-10-20T09:00:00Z", summary: "Queued memo", condition_score: null, media_assets: [], client_mutation_id: "diary-mutation" }];
  await invalidateTodayCare(client, "u", false);
  assert(client.getQueryData(doseKey).length === 1 && client.getQueryData(doseKey)[0].id === "server-dose" && client.getQueryData(diaryKey).length === 1 && client.getQueryData(diaryKey)[0].id === "server-diary", "replay applied before outbox removal merges by client mutation without duplicates");
  const memoriesAfterReplay = await fetchDiaryMemories("a", database, "u"); assert(memoriesAfterReplay.length === 1 && memoriesAfterReplay[0].entry.id === "server-diary", "memories canonical replay ID replaces queued ID without duplicate");
  pending = []; await invalidateTodayCare(client, "u", false); assert(client.getQueryData(doseKey).length === 1 && client.getQueryData(diaryKey).length === 1, "after replay removal server rows remain");
  unsubscribeDose(); unsubscribeDiary(); client.clear();
} finally { modules._load = original; }
function assert(value: unknown, message: string): void { if (!value) throw new Error(message); }
export {};
