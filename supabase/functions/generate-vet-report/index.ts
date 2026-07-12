import { corsHeaders, errorResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { requirePetMember, requireUser, serviceClient } from "../_shared/supabase.ts";
import { buildNormalizedVetReportPayload, vetReportDisclaimer } from "../_shared/vetReportArtifact.ts";

type RequestBody = {
  petId: string;
  rangeDays: 3 | 7 | 14;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = serviceClient();
    const user = await requireUser(request, supabase);
    const body = await readJson<RequestBody>(request);
    if (!body.petId || ![3, 7, 14].includes(body.rangeDays)) {
      throw new Error("A valid pet and report range are required");
    }
    await requirePetMember(supabase, body.petId, user.id, ["owner"]);

    const untilDate = new Date();
    const until = untilDate.toISOString();
    const since = new Date(untilDate.getTime() - body.rangeDays * 24 * 60 * 60 * 1000).toISOString();
    const [petResult, entriesResult, dosesResult] = await Promise.all([
      supabase.from("pets").select("name,species,breed,weight_kg").eq("id", body.petId).single(),
      supabase.from("diary_entries").select("category,summary,occurred_at,condition_score").eq("pet_id", body.petId).is("superseded_by", null).gte("occurred_at", since).lte("occurred_at", until),
      supabase.from("medication_doses").select("medication_name,status,scheduled_at,reaction_note").eq("pet_id", body.petId).gte("scheduled_at", since).lte("scheduled_at", until),
    ]);
    if (petResult.error) throw petResult.error;
    if (entriesResult.error) throw entriesResult.error;
    if (dosesResult.error) throw dosesResult.error;

    const pet = petResult.data;
    const payload = buildNormalizedVetReportPayload(pet, entriesResult.data, dosesResult.data);

    const englishSummary = [
      `${pet.name} has ${payload.entries.length} diary records and ${payload.medicationDoses.length} medication records in the last ${body.rangeDays} days.`,
      "The report is based only on care-team-entered records.",
      vetReportDisclaimer,
    ].join(" ");

    const { data: reportId, error: reportError } = await supabase.rpc("create_vet_report_draft_v1", {
      p_pet_id: body.petId,
      p_range_days: body.rangeDays,
      p_english_summary: englishSummary,
      p_payload: payload,
      p_created_by: user.id,
    });
    if (reportError || !reportId) throw reportError ?? new Error("Report draft transaction returned no id");

    return jsonResponse({ reportId, englishSummary, payload });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to generate report", 400);
  }
});
