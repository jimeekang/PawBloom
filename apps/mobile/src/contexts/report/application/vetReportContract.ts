import { z } from "zod";
import type { VetReportRangeDays, VetReportStatus } from "../domain/vetReport";

export const vetReportDisclaimer = "This is a record-based summary, not a diagnosis. Contact a veterinarian for medical decisions.";

const rangeDaysSchema = z.union([z.literal(3), z.literal(7), z.literal(14)]);
const reportStatusSchema = z.enum(["draft", "confirmed", "shared"]);
const timestampSchema = z.string().datetime({ offset: true });
const displayStringSchema = z.string().refine((value) => !isJsonObjectString(value), "display fields must not contain encoded JSON objects");
const reportPayloadSchema = z.object({
  version: z.literal(1),
  pet: z.object({
    name: z.string(),
    species: z.string(),
    breed: z.string().nullable(),
    weightKg: z.number().nullable(),
  }).nullable(),
  entries: z.array(z.object({
    category: z.enum(["food", "water", "walk", "stool", "condition", "memo", "photo"]),
    summary: displayStringSchema,
    memo: displayStringSchema.nullable(),
    details: z.array(z.object({ label: displayStringSchema.min(1), value: displayStringSchema.min(1) })),
    occurredAt: timestampSchema,
    conditionScore: z.number().min(1).max(5).nullable(),
  })),
  medicationDoses: z.array(z.object({
    medicationName: z.string(),
    status: z.enum(["pending", "completed", "partial", "skipped"]),
    scheduledAt: timestampSchema,
    conditionName: displayStringSchema.nullable(),
    dosageLabel: displayStringSchema.nullable(),
    administeredAmount: displayStringSchema.nullable(),
    reactionNote: displayStringSchema.nullable(),
  })),
  disclaimer: z.literal(vetReportDisclaimer),
});

const generatedVetReportSchema = z.object({
  reportId: z.string().min(1),
  englishSummary: z.string().refine((value) => value.includes(vetReportDisclaimer)),
  payload: reportPayloadSchema,
}).strict();

const sharedVetReportSchema = z.object({
  rangeDays: rangeDaysSchema,
  status: z.literal("shared"),
  englishSummary: z.string().refine((value) => value.includes(vetReportDisclaimer)),
  payload: reportPayloadSchema,
  createdAt: timestampSchema,
}).strict();

const authenticatedVetReportStateSchema = z.object({
  report: z.object({
    reportId: z.string().min(1),
    petId: z.string().min(1),
    rangeDays: rangeDaysSchema,
    status: reportStatusSchema,
    confirmedByOwner: z.boolean(),
    englishSummary: z.string().refine((value) => value.includes(vetReportDisclaimer)),
    payload: reportPayloadSchema,
    createdAt: timestampSchema,
  }).nullable(),
  shareToken: z.string().min(32).nullable(),
  expiresAt: timestampSchema.nullable(),
}).superRefine((value, context) => {
  if (Boolean(value.shareToken) !== Boolean(value.expiresAt)) {
    context.addIssue({ code: "custom", message: "share token and expiry must be returned together" });
  }
  if (value.shareToken && (!value.report?.confirmedByOwner || value.report.status === "draft")) {
    context.addIssue({ code: "custom", message: "draft reports cannot receive share tokens" });
  }
  if (value.shareToken && value.report?.status !== "shared") {
    context.addIssue({ code: "custom", message: "issued share tokens require shared report status" });
  }
});

export type VetReportPayload = z.infer<typeof reportPayloadSchema>;
export type GenerateVetReportResponse = z.infer<typeof generatedVetReportSchema>;
export type SharedVetReportResponse = z.infer<typeof sharedVetReportSchema>;
export type AuthenticatedVetReportStateResponse = z.infer<typeof authenticatedVetReportStateSchema>;

export type GeneratedVetReport = GenerateVetReportResponse & {
  shareToken: string | null;
  expiresAt: string | null;
  petId: string;
  rangeDays: VetReportRangeDays;
  status: VetReportStatus;
  confirmedByOwner: boolean;
  shareUrl: string | null;
};

export function parseGenerateVetReportResponse(value: unknown) {
  return generatedVetReportSchema.parse(value);
}

export function parseSharedVetReportResponse(value: unknown) {
  return sharedVetReportSchema.parse(value);
}

export function parseAuthenticatedVetReportStateResponse(value: unknown) {
  return authenticatedVetReportStateSchema.parse(value);
}

export function buildVetReportShareUrl(supabaseUrl: string, shareToken: string) {
  const url = new URL("/functions/v1/get-vet-report", ensureTrailingSlash(supabaseUrl));
  url.searchParams.set("token", shareToken);
  return url.toString();
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function isJsonObjectString(value: string) {
  try {
    const parsed = JSON.parse(value);
    return parsed !== null && typeof parsed === "object";
  } catch {
    return false;
  }
}
