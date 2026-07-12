import { corsHeaders, errorResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { requirePetMember, requireUser, serviceClient, sha256Hex } from "../_shared/supabase.ts";

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
    if (!body.petId || ![3, 7, 14].includes(body.rangeDays)) {
      throw new Error("A valid pet and report range are required");
    }
    await requirePetMember(supabase, body.petId, user.id, ["owner", "caregiver"]);

    const since = new Date(Date.now() - body.rangeDays * 24 * 60 * 60 * 1000).toISOString();
    const [petResult, entriesResult, dosesResult] = await Promise.all([
      supabase.from("pets").select("name,species,breed,weight_kg").eq("id", body.petId).single(),
      supabase.from("diary_entries").select("category,summary,occurred_at,condition_score").eq("pet_id", body.petId).gte("occurred_at", since),
      supabase.from("medication_doses").select("medication_name,status,scheduled_at,reaction_note").eq("pet_id", body.petId).gte("scheduled_at", since),
    ]);
    if (petResult.error) throw petResult.error;
    if (entriesResult.error) throw entriesResult.error;
    if (dosesResult.error) throw dosesResult.error;

    const pet = petResult.data;
    const entries = entriesResult.data;
    const doses = dosesResult.data;

    const englishSummary = [
      `${pet.name} has ${entries.length} diary records and ${doses.length} medication records in the last ${body.rangeDays} days.`,
      "The report is based only on owner-entered records.",
      disclaimer,
    ].join(" ");

    const payload = {
      pet,
      entries,
      medicationDoses: doses,
      disclaimer,
    };

    const { data: report, error: reportError } = await supabase
      .from("vet_reports")
      .insert({
        pet_id: body.petId,
        range_days: body.rangeDays,
        status: "draft",
        english_summary: englishSummary,
        payload,
        confirmed_by_owner: false,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (reportError) {
      throw reportError;
    }

    const rawToken = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
    const tokenHash = await sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: tokenError } = await supabase.from("report_share_tokens").insert({
      report_id: report.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: user.id,
    });

    if (tokenError) {
      throw tokenError;
    }

    return jsonResponse({ reportId: report.id, shareToken: rawToken, expiresAt, englishSummary, payload });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to generate report", 400);
  }
});
