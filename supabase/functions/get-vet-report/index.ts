import { corsHeaders, errorResponse, jsonResponse } from "../_shared/http.ts";
import { serviceClient, sha256Hex } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return errorResponse("Missing report token", 400);
    }

    const supabase = serviceClient();
    const tokenHash = await sha256Hex(token);
    const { data: share, error: shareError } = await supabase
      .from("report_share_tokens")
      .select("id,report_id,expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (shareError || !share || new Date(share.expires_at).getTime() < Date.now()) {
      return errorResponse("Report link is invalid or expired", 404);
    }

    const { data: report, error: reportError } = await supabase
      .from("vet_reports")
      .select("id,range_days,status,english_summary,payload,created_at")
      .eq("id", share.report_id)
      .single();

    if (reportError || !report) {
      return errorResponse("Report not found", 404);
    }

    await supabase.from("report_share_tokens").update({ last_accessed_at: new Date().toISOString() }).eq("id", share.id);

    return jsonResponse({
      id: report.id,
      rangeDays: report.range_days,
      status: report.status,
      englishSummary: report.english_summary,
      payload: report.payload,
      createdAt: report.created_at,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to read report", 400);
  }
});

