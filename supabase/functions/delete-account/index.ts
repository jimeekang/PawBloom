import { corsHeaders, errorResponse, jsonResponse } from "../_shared/http.ts";
import { requireUser, serviceClient, type ServiceClient } from "../_shared/supabase.ts";

// In-app account deletion (Apple Guideline 5.1.1(v)). Purges Storage objects for
// every pet the caller OWNS, then deletes the auth user. Owned pets and their
// child records cascade away; records the caller contributed to someone else's
// pet remain and anonymize `created_by` through ON DELETE SET NULL. Pets the
// caller only belongs to remain intact, while their membership row cascades.
const STORAGE_BUCKET = "pet-media";
const STORAGE_PAGE_SIZE = 100;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const supabase = serviceClient();
    const user = await requireUser(request, supabase);

    const { data: ownedPets, error: petsError } = await supabase
      .from("pets")
      .select("id")
      .eq("owner_id", user.id);
    if (petsError) throw petsError;

    for (const pet of ownedPets ?? []) {
      await purgePetMedia(supabase, String((pet as { id: string }).id));
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return jsonResponse({ ok: true });
  } catch (error) {
    // Log the detail server-side; never return it (schema/constraint names leak).
    console.error("delete-account failed", error);
    return errorResponse("Failed to delete account", 500);
  }
});

// Recursively remove every object under the pet's Storage prefix. Uploads nest
// files (e.g. `${petId}/profile/...`, `${petId}/diary/${entryId}/...`), and
// Storage list() is not recursive, so we walk folders (entries with a null id)
// depth-first. Removing already-deleted objects is a no-op, so retries are safe.
async function purgePetMedia(supabase: ServiceClient, petId: string): Promise<void> {
  const prefixes = [petId];

  while (prefixes.length > 0) {
    const prefix = prefixes.pop() as string;
    const files: string[] = [];
    let offset = 0;

    for (;;) {
      const { data: entries, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .list(prefix, { limit: STORAGE_PAGE_SIZE, offset });
      if (error) throw error;
      if (!entries || entries.length === 0) break;

      // Storage synthesizes folder entries with a null id; real files carry one.
      for (const entry of entries as Array<{ id: string | null; name: string }>) {
        const path = `${prefix}/${entry.name}`;
        if (entry.id === null) prefixes.push(path);
        else files.push(path);
      }

      if (entries.length < STORAGE_PAGE_SIZE) break;
      offset += entries.length;
    }

    for (let start = 0; start < files.length; start += STORAGE_PAGE_SIZE) {
      const { error: removeError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove(files.slice(start, start + STORAGE_PAGE_SIZE));
      if (removeError) throw removeError;
    }
  }
}
