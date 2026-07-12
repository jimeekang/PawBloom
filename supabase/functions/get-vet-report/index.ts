import { corsHeaders, errorResponse as baseErrorResponse, jsonResponse as baseJsonResponse } from "../_shared/http.ts";
import { serviceClient, sha256Hex } from "../_shared/supabase.ts";
import { sanitizeStoredVetReportPayload, vetReportDisclaimer } from "../_shared/vetReportArtifact.ts";
import { vetReportTextResponse } from "../_shared/vetReportText.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "GET") return errorResponse("Method not allowed", 405);

  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    const responseFormat = url.searchParams.get("format");
    if (!token) {
      return errorResponse("Missing report token", 400);
    }

    const supabase = serviceClient();
    const tokenHash = await sha256Hex(token);
    const { data: share, error: shareError } = await supabase
      .from("report_share_tokens")
      .select("id,report_id,expires_at,revoked_at")
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .maybeSingle();

    if (shareError || !share || new Date(share.expires_at).getTime() < Date.now()) {
      return errorResponse("Report link is invalid or expired", 404);
    }

    const { data: report, error: reportError } = await supabase
      .from("vet_reports")
      .select("id,range_days,status,english_summary,payload,confirmed_by_owner,created_at")
      .eq("id", share.report_id)
      .single();

    if (reportError || !report) {
      return errorResponse("Report not found", 404);
    }
    if (!report.confirmed_by_owner || report.status !== "shared") {
      return errorResponse("Report has not been confirmed for sharing", 404);
    }
    const payload = asRecord(report.payload);
    if (payload.disclaimer !== vetReportDisclaimer || !report.english_summary.includes(vetReportDisclaimer)) {
      return errorResponse("Report safety disclaimer is invalid", 404);
    }

    await supabase.from("report_share_tokens").update({ last_accessed_at: new Date().toISOString() }).eq("id", share.id);

    const responseBody = {
      rangeDays: report.range_days,
      status: report.status,
      englishSummary: report.english_summary,
      payload: sanitizeStoredVetReportPayload(report.payload),
      createdAt: report.created_at,
    };
    return responseFormat === "json" ? jsonResponse(responseBody) : vetReportTextResponse(responseBody);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to read report", 400);
  }
});

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

const tokenResponseHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

function jsonResponse(body: unknown, status = 200) {
  return baseJsonResponse(body, status, tokenResponseHeaders);
}

function errorResponse(message: string, status = 400) {
  return baseErrorResponse(message, status, tokenResponseHeaders);
}
