import { corsHeaders, errorResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { requirePetMember, requireUser, serviceClient } from "../_shared/supabase.ts";

type RequestBody = {
  petId: string;
  rangeDays: 3 | 7 | 14;
};

const disclaimer = "This is a record-based summary, not a diagnosis. Contact a veterinarian for medical decisions.";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = serviceClient();
    const user = await requireUser(request, supabase);
    const body = await readJson<RequestBody>(request);
    await requirePetMember(supabase, body.petId, user.id);

    const since = new Date(Date.now() - body.rangeDays * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: entries }, { data: doses }] = await Promise.all([
      supabase
        .from("diary_entries")
        .select("category,summary,occurred_at,condition_score")
        .eq("pet_id", body.petId)
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false }),
      supabase
        .from("medication_doses")
        .select("medication_name,status,scheduled_at,reaction_note")
        .eq("pet_id", body.petId)
        .gte("scheduled_at", since)
        .order("scheduled_at", { ascending: false }),
    ]);

    const missedDoses = (doses ?? []).filter((dose) => dose.status === "skipped").length;
    const lowCondition = (entries ?? []).filter((entry) => Number(entry.condition_score ?? 5) <= 2).length;

    const payload = {
      rangeDays: body.rangeDays,
      highlights: [
        `${entries?.length ?? 0} diary records were reviewed.`,
        `${doses?.length ?? 0} medication records were reviewed.`,
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
      throw error;
    }

    return jsonResponse({ briefId: brief.id, createdAt: brief.created_at, payload });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to generate brief", 400);
  }
});

