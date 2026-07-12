import { buildVetReportShareUrl, parseGenerateVetReportResponse, parseSharedVetReportResponse, vetReportDisclaimer, type GeneratedVetReport } from "./vetReportContract";
import { formatReportExpiry, getReportPrimaryAction, hasUsableReportLink } from "../ui/reportWorkflow";

const shareToken = "token-with-reserved-characters-+/=0123456789";
const payload = {
  version: 1 as const,
  pet: { name: "Mochi", species: "dog", breed: "Shiba", weightKg: 9.2 },
  entries: [{ category: "condition" as const, summary: "Energy: Normal", memo: null, details: [{ label: "Energy", value: "Normal" }], occurredAt: "2026-07-12T01:00:00.000Z", conditionScore: 3 }],
  medicationDoses: [{ medicationName: "Cerenia", status: "completed" as const, scheduledAt: "2026-07-12T08:00:00.000Z", conditionName: null, dosageLabel: "16 mg", administeredAmount: "16 mg", reactionNote: null }],
  disclaimer: vetReportDisclaimer,
};
const generatedResponse = {
  reportId: "report-1",
  englishSummary: `Owner-entered records were reviewed. ${vetReportDisclaimer}`,
  payload,
};

const parsedGenerated = parseGenerateVetReportResponse(generatedResponse);
if (parsedGenerated.reportId !== "report-1" || parsedGenerated.payload.disclaimer !== vetReportDisclaimer) {
  throw new Error("generate-vet-report responses must preserve the report id and required safety disclaimer");
}

assertRejects(() => parseGenerateVetReportResponse({ ...generatedResponse, englishSummary: "No disclaimer" }), "generated reports without the required safety disclaimer must be rejected");
assertRejects(() => parseGenerateVetReportResponse({ ...generatedResponse, shareToken }), "draft generation must reject pre-confirmation share tokens");
assertRejects(() => parseSharedVetReportResponse({ id: "report-1", rangeDays: 7, status: "draft", englishSummary: generatedResponse.englishSummary, payload, createdAt: "2026-07-12T10:00:00.000Z" }), "public report responses must reject unconfirmed draft status");
assertRejects(() => parseSharedVetReportResponse({ rangeDays: 7, status: "confirmed", englishSummary: generatedResponse.englishSummary, payload, createdAt: "2026-07-12T10:00:00.000Z" }), "public report responses must reject confirmed reports without a shared token lifecycle");
assertRejects(() => parseSharedVetReportResponse({ id: "internal-report-id", rangeDays: 7, status: "shared", englishSummary: generatedResponse.englishSummary, payload, createdAt: "2026-07-12T10:00:00.000Z" }), "public report responses must reject internal database identifiers");

const shared = parseSharedVetReportResponse({
  rangeDays: 7,
  status: "shared",
  englishSummary: generatedResponse.englishSummary,
  payload,
  createdAt: "2026-07-12T10:00:00.000Z",
});
if (shared.status !== "shared") throw new Error("only shared public reports must satisfy the mobile response contract");

const offsetShared = parseSharedVetReportResponse({
  rangeDays: 7,
  status: "shared",
  englishSummary: generatedResponse.englishSummary,
  payload: {
    ...payload,
    entries: [{ ...payload.entries[0], occurredAt: "2026-07-12T11:00:00+10:00" }],
    medicationDoses: [{ ...payload.medicationDoses[0], scheduledAt: "2026-07-12T18:00:00+10:00" }],
  },
  createdAt: "2026-07-12T20:00:00+10:00",
});
if (offsetShared.createdAt !== "2026-07-12T20:00:00+10:00") {
  throw new Error("PostgREST timestamptz values with explicit offsets must satisfy the report contract");
}

assertRejects(() => parseGenerateVetReportResponse({
  ...generatedResponse,
  payload: { ...payload, entries: [{ ...payload.entries[0], summary: '{"version":1,"detail":{"category":"condition"}}' }] },
}), "persisted report display fields must reject nested encoded diary JSON");
assertRejects(() => parseGenerateVetReportResponse({
  ...generatedResponse,
  payload: { ...payload, medicationDoses: [{ ...payload.medicationDoses[0], reactionNote: '{"version":1,"reactionNote":"sleepy"}' }] },
}), "persisted report display fields must reject nested encoded medication JSON");

const shareUrl = buildVetReportShareUrl("https://project.supabase.co", shareToken);
const parsedUrl = new URL(shareUrl);
if (parsedUrl.pathname !== "/functions/v1/get-vet-report" || parsedUrl.searchParams.get("token") !== shareToken) {
  throw new Error("share URLs must target get-vet-report and safely encode the raw token");
}

const report: GeneratedVetReport = { ...parsedGenerated, petId: "pet-1", rangeDays: 7, status: "draft", confirmedByOwner: false, shareToken: null, expiresAt: null, shareUrl: null };
if (getReportPrimaryAction({ report: null, hasRecords: false, canGenerate: true, isBusy: false }) !== null) throw new Error("empty reports must block generation");
if (getReportPrimaryAction({ report: null, hasRecords: true, canGenerate: true, isBusy: false }) !== "generate") throw new Error("eligible report summaries must offer generation");
if (getReportPrimaryAction({ report, hasRecords: true, canGenerate: true, isBusy: false }) !== "confirm") throw new Error("generated drafts must require owner confirmation");
if (getReportPrimaryAction({ report: { ...report, status: "confirmed", confirmedByOwner: true }, hasRecords: true, canGenerate: true, isBusy: false }) !== "share") throw new Error("confirmed reports must offer system sharing");
if (getReportPrimaryAction({ report, hasRecords: true, canGenerate: true, isBusy: true }) !== null) throw new Error("busy report workflows must block duplicate actions");
if (!formatReportExpiry("2026-07-19T10:00:00.000Z")) throw new Error("report expiry must have a visible formatted value");
const linkedReport = { ...report, status: "shared" as const, confirmedByOwner: true, shareToken, shareUrl, expiresAt: "2026-07-19T10:00:00.000Z" };
if (hasUsableReportLink(report)
  || !hasUsableReportLink(linkedReport, new Date("2026-07-12T10:00:00.000Z").getTime())
  || hasUsableReportLink(linkedReport, new Date("2026-07-20T10:00:00.000Z").getTime())) {
  throw new Error("sharing must issue a link when none exists and reuse only a complete, unexpired link");
}

function assertRejects(action: () => unknown, message: string) {
  try {
    action();
  } catch {
    return;
  }
  throw new Error(message);
}
