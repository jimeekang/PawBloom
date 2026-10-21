import type { DiaryEntry } from "../domain/diaryEntry";
declare const require: (name: string) => any;
const nodeModule = require("node:module");
const originalLoad = nodeModule._load;
let options: any;
let retried = "";
nodeModule._load = function(request: string, parent: unknown, isMain: boolean) {
  if (request === "@tanstack/react-query") return {
    useQueries: (input: any) => { options = input; return [
      { isError: false, isLoading: false, data: [{ source: "diary", entry: entry("a") }], refetch: () => { retried = "a"; } },
      { isError: true, isLoading: false, refetch: () => { retried = "b"; } },
    ]; },
  };
  if (request.endsWith("shared-kernel/supabase/client")) return { supabase: {} };
  return originalLoad.call(this, request, parent, isMain);
};
try {
  const { useDiaryMemories, diaryMemoriesKey, toDiaryMemoryItems, fetchDiaryMemories } = require("./diaryMemories");
  assert(JSON.stringify(diaryMemoriesKey("a", "account-a")) !== JSON.stringify(diaryMemoriesKey("a", "account-b")), "cache isolates accounts");
  assert(JSON.stringify(diaryMemoriesKey("a", "account-a")) !== JSON.stringify(diaryMemoriesKey("b", "account-a")), "cache isolates pets");
  const sources = toDiaryMemoryItems([entry("a"), { ...entry("a"), id: "photo", category: "photo" }, { ...entry("a"), category: "food" }, { ...entry("a"), origin: "checklist" }]);
  assert(sources.length === 2 && sources.every((item: any) => item.source === "diary"), "only diary photo/memo sources join the read-only feed");
  const results = useDiaryMemories(["a", "b"], "account-a", []);
  assert(results.petStates[0].status === "ready" && results.petStates[1].status === "error", "one pet failure preserves the successful pet");
  results.retryPet("b"); assert(retried === "b", "retry stays with failing pet");
  results.retryPet("revoked"); assert(retried === "b", "removed pet cannot be retried");
  assert(options.queries.every((query: any) => query.enabled), "authenticated queries enabled independently");
  const preview = useDiaryMemories(["b"], null, [entry("a"), entry("b")]);
  assert(preview.petStates[0].items.length === 1 && preview.petStates[0].items[0].entry.petId === "b", "preview reuses current local diary state and filters inaccessible pets");
  assert(options.queries.every((query: any) => !query.enabled), "preview never requests private records");
  const ranges: number[][] = [];
  const client = makeClient(ranges);
  const memories = await fetchDiaryMemories("a", client);
  assert(memories.length === 501 && ranges.length === 2 && ranges[1][0] === 500, "history is paged beyond server row limits without a date cutoff");
  assert(memories[0].entry.photoUrls[0] === "signed-private-photo", "private photo mapping uses signed URL helper");
  let rejected = false;
  try { await fetchDiaryMemories("a", makeClient([], true)); } catch { rejected = true; }
  assert(rejected, "failed history load rejects instead of reporting an empty complete feed");
} finally { nodeModule._load = originalLoad; }
function entry(petId: string): DiaryEntry { return { id: `memo-${petId}`, petId, origin: "diary", category: "memo", entryDate: "2026-10-19", occurredAt: "12:00", summary: petId }; }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function makeClient(ranges: number[][], fail = false) {
  const rows = Array.from({ length: 501 }, (_, i) => ({ id: String(i), pet_id: "a", category: i === 0 ? "photo" : "memo", record_origin: "diary", summary: "memo", entry_date: "2026-10-19", occurred_at: "2026-10-19T12:00:00Z", condition_score: null, media_assets: i === 0 ? [{ id: "photo", storage_path: "a/private.jpg" }] : [] }));
  const query: any = {};
  for (const method of ["select", "eq", "in", "is", "order"]) query[method] = () => query;
  query.range = async (from: number, to: number) => { ranges.push([from, to]); return { data: rows.slice(from, to + 1), error: fail ? new Error("offline") : null }; };
  return { from: () => query, storage: { from: () => ({ createSignedUrls: async () => ({ data: [{ path: "a/private.jpg", signedUrl: "signed-private-photo", error: null }], error: null }) }) } };
}
