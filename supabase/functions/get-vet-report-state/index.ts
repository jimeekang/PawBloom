import { corsHeaders, errorResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { requirePetMember, requireUser, serviceClient, sha256Hex } from "../_shared/supabase.ts";

type RequestBody = {
  petId: string;
  reportId?: string;
  issueShareToken?: boolean;
  revokeShareToken?: boolean;
};

const privateResponseHeaders = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") return errorResponse("Method not allowed", 405, privateResponseHeaders);

  try {
    const supabase = serviceClient();
    const user = await requireUser(request, supabase);
    const body = await readJson<RequestBody>(request);
    if (!body.petId) throw new Error("A pet is required");

    await requirePetMember(supabase, body.petId, user.id, ["owner"]);
    if (body.issueShareToken && body.revokeShareToken) throw new Error("Choose either issue or revoke, not both");
    if ((body.issueShareToken || body.revokeShareToken) && !body.reportId) throw new Error("A report is required to change a share link");

    let reportQuery = supabase
      .from("vet_reports")
      .select("id,pet_id,range_days,status,english_summary,payload,confirmed_by_owner,created_at")
      .eq("pet_id", body.petId);
    reportQuery = body.reportId
      ? reportQuery.eq("id", body.reportId)
      : reportQuery.order("created_at", { ascending: false }).limit(1);

    const { data: report, error: reportError } = await reportQuery.maybeSingle();
    if (reportError) throw reportError;
    if (!report) return jsonResponse({ report: null, shareToken: null, expiresAt: null }, 200, privateResponseHeaders);
    if (asRecord(report.payload).disclaimer !== "This is a record-based summary, not a diagnosis. Contact a veterinarian for medical decisions.") {
      throw new Error("Report safety disclaimer is invalid");
    }

    let shareToken: string | null = null;
    let expiresAt: string | null = null;
    if (body.issueShareToken) {
      if (!report.confirmed_by_owner || report.status === "draft") {
        throw new Error("Owner confirmation is required before issuing a report link");
      }

      shareToken = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
      expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const tokenHash = await sha256Hex(shareToken);
      const { error: tokenError } = await supabase.rpc("issue_vet_report_share_v1", {
        p_report_id: report.id,
        p_pet_id: body.petId,
        p_actor_id: user.id,
        p_token_hash: tokenHash,
        p_expires_at: expiresAt,
      });
      if (tokenError) throw tokenError;
    }
    if (body.revokeShareToken) {
      const { error: revokeError } = await supabase.rpc("revoke_vet_report_share_v1", {
        p_report_id: report.id,
        p_pet_id: body.petId,
        p_actor_id: user.id,
      });
      if (revokeError) throw revokeError;
    }

    return jsonResponse({
      report: {
        reportId: report.id,
        petId: report.pet_id,
        rangeDays: report.range_days,
        status: body.issueShareToken ? "shared" : body.revokeShareToken ? "confirmed" : report.status,
        confirmedByOwner: report.confirmed_by_owner,
        englishSummary: report.english_summary,
        payload: report.payload,
        createdAt: report.created_at,
      },
      shareToken,
      expiresAt,
    }, 200, privateResponseHeaders);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to load report state", 400, privateResponseHeaders);
  }
});

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
