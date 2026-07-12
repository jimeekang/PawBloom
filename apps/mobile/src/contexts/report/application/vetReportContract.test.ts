import { buildVetReportShareUrl, parseGenerateVetReportResponse, parseSharedVetReportResponse, vetReportDisclaimer, type GeneratedVetReport } from "./vetReportContract";
import { formatReportExpiry, getReportPrimaryAction } from "../ui/reportWorkflow";

const shareToken = "token-with-reserved-characters-+/=0123456789";
const payload = {
  pet: { name: "Mochi", species: "dog", breed: "Shiba", weight_kg: 9.2 },
  entries: [{ category: "condition", summary: "Energy score 3/5", occurred_at: "2026-07-12T01:00:00.000Z", condition_score: 3 }],
  medicationDoses: [{ medication_name: "Cerenia", status: "completed", scheduled_at: "2026-07-12T08:00:00.000Z", reaction_note: null }],
  disclaimer: vetReportDisclaimer,
};
const generatedResponse = {
  reportId: "report-1",
  shareToken,
  expiresAt: "2026-07-19T10:00:00.000Z",
  englishSummary: `Owner-entered records were reviewed. ${vetReportDisclaimer}`,
  payload,
};

const parsedGenerated = parseGenerateVetReportResponse(generatedResponse);
if (parsedGenerated.reportId !== "report-1" || parsedGenerated.payload.disclaimer !== vetReportDisclaimer) {
  throw new Error("generate-vet-report responses must preserve the report id and required safety disclaimer");
}

assertRejects(() => parseGenerateVetReportResponse({ ...generatedResponse, englishSummary: "No disclaimer" }), "generated reports without the required safety disclaimer must be rejected");
assertRejects(() => parseSharedVetReportResponse({ id: "report-1", rangeDays: 7, status: "draft", englishSummary: generatedResponse.englishSummary, payload, createdAt: "2026-07-12T10:00:00.000Z" }), "public report responses must reject unconfirmed draft status");

const shared = parseSharedVetReportResponse({
  id: "report-1",
  rangeDays: 7,
  status: "confirmed",
  englishSummary: generatedResponse.englishSummary,
  payload,
  createdAt: "2026-07-12T10:00:00.000Z",
});
if (shared.status !== "confirmed") throw new Error("confirmed public reports must satisfy the mobile response contract");

const offsetShared = parseSharedVetReportResponse({
  id: "report-offset",
  rangeDays: 7,
  status: "shared",
  englishSummary: generatedResponse.englishSummary,
  payload: {
    ...payload,
    entries: [{ ...payload.entries[0], occurred_at: "2026-07-12T11:00:00+10:00" }],
    medicationDoses: [{ ...payload.medicationDoses[0], scheduled_at: "2026-07-12T18:00:00+10:00" }],
  },
  createdAt: "2026-07-12T20:00:00+10:00",
});
if (offsetShared.createdAt !== "2026-07-12T20:00:00+10:00") {
  throw new Error("PostgREST timestamptz values with explicit offsets must satisfy the report contract");
}

const shareUrl = buildVetReportShareUrl("https://project.supabase.co", shareToken);
const parsedUrl = new URL(shareUrl);
if (parsedUrl.pathname !== "/functions/v1/get-vet-report" || parsedUrl.searchParams.get("token") !== shareToken) {
  throw new Error("share URLs must target get-vet-report and safely encode the raw token");
}

const report: GeneratedVetReport = { ...parsedGenerated, petId: "pet-1", rangeDays: 7, status: "draft", confirmedByOwner: false, shareUrl };
if (getReportPrimaryAction({ report: null, hasRecords: false, canGenerate: true, isBusy: false }) !== null) throw new Error("empty reports must block generation");
if (getReportPrimaryAction({ report: null, hasRecords: true, canGenerate: true, isBusy: false }) !== "generate") throw new Error("eligible report summaries must offer generation");
if (getReportPrimaryAction({ report, hasRecords: true, canGenerate: true, isBusy: false }) !== "confirm") throw new Error("generated drafts must require owner confirmation");
if (getReportPrimaryAction({ report: { ...report, status: "confirmed", confirmedByOwner: true }, hasRecords: true, canGenerate: true, isBusy: false }) !== "share") throw new Error("confirmed reports must offer system sharing");
if (getReportPrimaryAction({ report, hasRecords: true, canGenerate: true, isBusy: true }) !== null) throw new Error("busy report workflows must block duplicate actions");
if (!formatReportExpiry(generatedResponse.expiresAt)) throw new Error("report expiry must have a visible formatted value");

function assertRejects(action: () => unknown, message: string) {
  try {
    action();
  } catch {
    return;
  }
  throw new Error(message);
}
