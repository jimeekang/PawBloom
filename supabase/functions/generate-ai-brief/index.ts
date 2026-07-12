import { corsHeaders, errorResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { requirePetMember, requireUser, serviceClient } from "../_shared/supabase.ts";
import { AiBriefRequestError, parseAiBriefRequest } from "./contract.ts";

const disclaimer = "This is a record-based summary, not a diagnosis. Contact a veterinarian for medical decisions.";
const sourceFailureMessage = "Unable to load records for brief generation";

class AiBriefSourceError extends Error {
  constructor() {
    super(sourceFailureMessage);
    this.name = "AiBriefSourceError";
  }
}

function failSourceQuery(source: string, cause: unknown): never {
  console.error(`generate-ai-brief ${source} query failed`, cause);
  throw new AiBriefSourceError();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = serviceClient();
    const user = await requireUser(request, supabase);
    const body = parseAiBriefRequest(await readJson<unknown>(request));
    await requirePetMember(supabase, body.petId, user.id);

    const until = new Date().toISOString();
    const since = new Date(Date.parse(until) - body.rangeDays * 24 * 60 * 60 * 1000).toISOString();
    const [entriesResult, dosesResult] = await Promise.all([
      supabase
        .from("diary_entries")
        .select("category,summary,occurred_at,condition_score")
        .eq("pet_id", body.petId)
        .is("superseded_by", null)
        .gte("occurred_at", since)
        .lte("occurred_at", until)
        .order("occurred_at", { ascending: false }),
      supabase
        .from("medication_doses")
        .select("medication_name,status,scheduled_at,reaction_note")
        .eq("pet_id", body.petId)
        .gte("scheduled_at", since)
        .lte("scheduled_at", until)
        .order("scheduled_at", { ascending: false }),
    ]).catch((error: unknown) => failSourceQuery("source records", error));

    if (entriesResult.error) failSourceQuery("diary entries", entriesResult.error);
    if (dosesResult.error) failSourceQuery("medication doses", dosesResult.error);

    const entries = entriesResult.data ?? [];
    const doses = dosesResult.data ?? [];

    const missedDoses = doses.filter((dose) => dose.status === "skipped").length;
    const lowCondition = entries.filter((entry) => Number(entry.condition_score ?? 5) <= 2).length;

    const payload = {
      rangeDays: body.rangeDays,
      highlights: [
        `${entries.length} diary records were reviewed.`,
        `${doses.length} medication records were reviewed.`,
        missedDoses > 0 ? `${missedDoses} medication records were marked skipped.` : "No skipped medication records were found.",
        lowCondition > 0 ? `${lowCondition} low-condition records may be worth discussing with a veterinarian.` : "No repeated low-condition pattern was found in the reviewed records.",
      ],
      questionsForVet: [
        "When did the appetite, water, stool, or energy change first appear?",
        "Should the current medication schedule continue unchanged?",
      ],
      disclaimer,
    };

    const { data: brief, error } = await supabase
      .from("ai_briefs")
      .insert({
        pet_id: body.petId,
        range_days: body.rangeDays,
        payload,
        created_by: user.id,
      })
      .select("id,created_at")
      .single();

    if (error) {
      console.error("generate-ai-brief persistence failed", error);
      return errorResponse("Unable to save generated brief", 500);
    }

    return jsonResponse({ briefId: brief.id, createdAt: brief.created_at, payload });
  } catch (error) {
    if (error instanceof AiBriefRequestError) return errorResponse(error.message, 400);
    if (error instanceof AiBriefSourceError) return errorResponse(error.message, 500);
    return errorResponse(error instanceof Error ? error.message : "Failed to generate brief", 400);
  }
});
