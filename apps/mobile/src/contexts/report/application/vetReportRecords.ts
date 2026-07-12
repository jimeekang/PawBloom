import { FunctionsHttpError } from "@supabase/supabase-js";
import { env } from "../../../shared-kernel/config";
import { supabase } from "../../../shared-kernel/supabase/client";
import type { VetReportRangeDays } from "../domain/vetReport";
import {
  buildVetReportShareUrl,
  parseAuthenticatedVetReportStateResponse,
  parseGenerateVetReportResponse,
  parseSharedVetReportResponse,
  type GeneratedVetReport,
} from "./vetReportContract";

export async function generateVetReport({ petId, rangeDays = 7 }: { petId: string; rangeDays?: VetReportRangeDays }): Promise<GeneratedVetReport> {
  const client = requireSupabaseClient();
  const { data, error } = await client.functions.invoke<unknown>("generate-vet-report", {
    body: { petId, rangeDays },
  });

  if (error) throw new Error(await edgeFunctionErrorMessage(error));
  const response = parseGenerateVetReportResponse(data);
  return {
    ...response,
    petId,
    rangeDays,
    status: "draft",
    confirmedByOwner: false,
    shareToken: null,
    expiresAt: null,
    shareUrl: null,
  };
}

export async function loadVetReportState({
  petId,
  reportId,
  issueShareToken = false,
  revokeShareToken = false,
}: {
  petId: string;
  reportId?: string;
  issueShareToken?: boolean;
  revokeShareToken?: boolean;
}): Promise<GeneratedVetReport | null> {
  const client = requireSupabaseClient();
  const { data, error } = await client.functions.invoke<unknown>("get-vet-report-state", {
    body: { petId, reportId, issueShareToken, revokeShareToken },
  });
  if (error) throw new Error(await edgeFunctionErrorMessage(error));

  const response = parseAuthenticatedVetReportStateResponse(data);
  if (!response.report) return null;
  return {
    reportId: response.report.reportId,
    petId: response.report.petId,
    rangeDays: response.report.rangeDays,
    status: response.report.status,
    confirmedByOwner: response.report.confirmedByOwner,
    englishSummary: response.report.englishSummary,
    payload: response.report.payload,
    shareToken: response.shareToken,
    expiresAt: response.expiresAt,
    shareUrl: response.shareToken ? buildVetReportShareUrl(env.supabaseUrl, response.shareToken) : null,
  };
}

export async function confirmVetReport({ reportId, petId }: { reportId: string; petId: string }) {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .rpc("confirm_vet_report", { target_report_id: reportId, target_pet_id: petId })
    .single();

  if (error || !data || data.status !== "confirmed" || !data.confirmed_by_owner) {
    throw new Error(error?.message ?? "Report confirmation failed.");
  }
  return data;
}

export async function readSharedVetReport(shareToken: string) {
  const client = requireSupabaseClient();
  const functionName = `get-vet-report?token=${encodeURIComponent(shareToken)}&format=json`;
  const { data, error } = await client.functions.invoke<unknown>(functionName, { method: "GET" });

  if (error) throw new Error(await edgeFunctionErrorMessage(error));
  return parseSharedVetReportResponse(data);
}

function requireSupabaseClient() {
  if (!supabase || !env.supabaseUrl) throw new Error("Supabase client is not configured.");
  return supabase;
}

async function edgeFunctionErrorMessage(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.clone().json() as { error?: unknown };
      if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
    } catch {
      // Fall through to the SDK error message when the response is not JSON.
    }
  }
  return error instanceof Error ? error.message : "Edge Function request failed.";
}
