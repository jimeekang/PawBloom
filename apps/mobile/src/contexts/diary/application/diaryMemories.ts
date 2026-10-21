import { overlayPendingDiaryEntries } from "./pendingDiaryEntries";
import { useQueries } from "@tanstack/react-query";
import type { DiaryEntry } from "../domain/diaryEntry";
import { supabase } from "../../../shared-kernel/supabase/client";
import { diaryEntrySelect, pairDiaryRowsWithSignedPhotos, type DiaryRowWithMedia } from "./diaryRecordQueries";
import { mapDiaryRow } from "./diaryRecords";
export type DiaryMemoryItem = { source: "diary"; entry: DiaryEntry };
export type DiaryMemoryPetState = { petId: string; status: "loading" | "error" | "ready"; items: DiaryMemoryItem[] };
export const diaryMemoriesKey = (petId: string, userId: string | null) => ["diary", "memories", petId, userId] as const;
export function toDiaryMemoryItems(entries: readonly DiaryEntry[]): DiaryMemoryItem[] {
  return entries.filter((entry) => entry.origin === "diary" && (entry.category === "photo" || entry.category === "memo"))
    .map((entry) => ({ source: "diary", entry }));
}
/** Independent account+pet queries never switch the active editor to collect records. */
export function useDiaryMemories(petIds: readonly string[], userId: string | null, localEntries: readonly DiaryEntry[]) {
  const queries = useQueries({ queries: petIds.map((petId) => ({
    queryKey: diaryMemoriesKey(petId, userId),
    enabled: Boolean(supabase && userId),
    queryFn: () => fetchDiaryMemories(petId, supabase, userId),
  })) });
  const petStates: DiaryMemoryPetState[] = petIds.map((petId, index) => ({
    petId,
    status: !userId ? "ready" : queries[index].isError ? "error" : queries[index].isLoading ? "loading" : "ready",
    items: !userId ? toDiaryMemoryItems(localEntries.filter((entry) => entry.petId === petId)) : queries[index].data ?? [],
  }));
  function retryPet(petId: string) { const index = petIds.indexOf(petId); if (index >= 0) void queries[index].refetch(); }
  return { petStates, retryPet };
}

/** Page through all diary history so the server row limit cannot masquerade as a complete feed. */
export async function fetchDiaryMemories(petId: string, client = supabase, userId?: string | null) {
  if (!client) throw new Error("common.loginRequired");
  const rows: DiaryRowWithMedia[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from("diary_entries").select(diaryEntrySelect)
      .eq("pet_id", petId).eq("record_origin", "diary").in("category", ["photo", "memo"])
      .is("superseded_by", null).order("occurred_at", { ascending: false }).order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as DiaryRowWithMedia[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  const paths = [...new Set(rows.flatMap((row) => (row.media_assets ?? []).flatMap((asset) => asset.storage_path ? [asset.storage_path] : [])))];
  const signedPhotos = [];
  for (let offset = 0; offset < paths.length; offset += pageSize) {
    const { data, error } = await client.storage.from("pet-media").createSignedUrls(paths.slice(offset, offset + pageSize), 60 * 60);
    if (error) throw error;
    signedPhotos.push(...(data ?? []));
  }
  const entries = pairDiaryRowsWithSignedPhotos(rows, signedPhotos).map(({ row, photoUrls }) => mapDiaryRow(row, photoUrls));
  return toDiaryMemoryItems(await overlayPendingDiaryEntries(entries, rows.map((row) => row.client_mutation_id), petId, userId, "0000-01-01", "9999-12-31"));
}
