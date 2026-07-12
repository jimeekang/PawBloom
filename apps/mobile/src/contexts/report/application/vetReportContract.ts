import { z } from "zod";
import type { VetReportRangeDays, VetReportStatus } from "../domain/vetReport";

export const vetReportDisclaimer = "This is a record-based summary, not a diagnosis. Contact a veterinarian for medical decisions.";

const rangeDaysSchema = z.union([z.literal(3), z.literal(7), z.literal(14)]);
const reportStatusSchema = z.enum(["draft", "confirmed", "shared"]);
const timestampSchema = z.string().datetime({ offset: true });
const reportPayloadSchema = z.object({
  pet: z.object({
    name: z.string(),
    species: z.string(),
    breed: z.string().nullable(),
    weight_kg: z.number().nullable(),
  }).nullable(),
  entries: z.array(z.object({
    category: z.string(),
    summary: z.string(),
    occurred_at: timestampSchema,
    condition_score: z.number().nullable(),
  })),
  medicationDoses: z.array(z.object({
    medication_name: z.string(),
    status: z.string(),
    scheduled_at: timestampSchema,
    reaction_note: z.string().nullable(),
  })),
  disclaimer: z.literal(vetReportDisclaimer),
});

const generatedVetReportSchema = z.object({
  reportId: z.string().min(1),
  shareToken: z.string().min(32),
  expiresAt: timestampSchema,
  englishSummary: z.string().refine((value) => value.includes(vetReportDisclaimer)),
  payload: reportPayloadSchema,
});

const sharedVetReportSchema = z.object({
  id: z.string().min(1),
  rangeDays: rangeDaysSchema,
  status: reportStatusSchema.refine((status) => status !== "draft"),
  englishSummary: z.string().refine((value) => value.includes(vetReportDisclaimer)),
  payload: reportPayloadSchema,
  createdAt: timestampSchema,
});

export type VetReportPayload = z.infer<typeof reportPayloadSchema>;
export type GenerateVetReportResponse = z.infer<typeof generatedVetReportSchema>;
export type SharedVetReportResponse = z.infer<typeof sharedVetReportSchema>;

export type GeneratedVetReport = GenerateVetReportResponse & {
  petId: string;
  rangeDays: VetReportRangeDays;
  status: VetReportStatus;
  confirmedByOwner: boolean;
  shareUrl: string;
};

export function parseGenerateVetReportResponse(value: unknown) {
  return generatedVetReportSchema.parse(value);
}

export function parseSharedVetReportResponse(value: unknown) {
  return sharedVetReportSchema.parse(value);
}

export function buildVetReportShareUrl(supabaseUrl: string, shareToken: string) {
  const url = new URL("/functions/v1/get-vet-report", ensureTrailingSlash(supabaseUrl));
  url.searchParams.set("token", shareToken);
  return url.toString();
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
