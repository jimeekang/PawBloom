declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as { readFileSync(path: string, encoding: "utf8"): string };
const { renderVetReportText, vetReportTextResponse } = require("../../../../../../supabase/functions/_shared/vetReportText.ts") as {
  renderVetReportText(report: Record<string, unknown>): string;
  vetReportTextResponse(report: Record<string, unknown>): Response;
};
const { vetReportDisclaimer } = require("../../../../../../supabase/functions/_shared/vetReportArtifact.ts") as { vetReportDisclaimer: string };

const report = {
  rangeDays: 7,
  status: "shared",
  englishSummary: `Owner entered <script>alert(1)</script> & notes.\u0085\u202E\u2066 ${vetReportDisclaimer}`,
  createdAt: "2026-07-12T10:00:00.000Z",
  payload: {
    version: 1,
    pet: { name: "Mochi <img>", species: "dog", breed: "Shiba & mix", weightKg: 9.2 },
    entries: [{ category: "memo", summary: "line one\nline two", memo: null, details: [], occurredAt: "2026-07-12T08:00:00.000Z", conditionScore: null }],
    medicationDoses: [{ medicationName: "Cerenia", status: "completed", scheduledAt: "2026-07-12T09:00:00.000Z", conditionName: null, dosageLabel: "16 mg", administeredAmount: "16 mg", reactionNote: "calm & alert" }],
    disclaimer: vetReportDisclaimer,
  },
};

const textReport = renderVetReportText(report);
if (!textReport.startsWith("PAWBLOOM VETERINARY CARE REPORT") || !textReport.includes("DIARY RECORDS (1)") || !textReport.includes("MEDICATION RECORDS (1)")) {
  throw new Error("public report links must render a complete, readable text report");
}
if (textReport.includes("<script>") || textReport.includes("<img>") || /[\u0085\u202E\u2066]/.test(textReport) || !textReport.includes("line one line two") || !textReport.includes(vetReportDisclaimer)) {
  throw new Error("public text fields must remove markup and display-control characters while preserving the required disclaimer");
}

const response = vetReportTextResponse(report);
if (!response.headers.get("content-type")?.includes("text/plain") || response.headers.get("cache-control") !== "no-store, max-age=0") {
  throw new Error("public report text must use the platform-supported content type and must not be cached");
}
if (!response.headers.get("content-disposition")?.includes("inline") || response.headers.get("x-content-type-options") !== "nosniff") {
  throw new Error("public report text must remain inline and ship restrictive browser headers");
}
if (!response.headers.get("content-security-policy")?.includes("frame-ancestors 'none'") || response.headers.get("x-frame-options") !== "DENY") {
  throw new Error("public bearer-token reports must not be embedded in third-party frames");
}
if (response.headers.get("referrer-policy") !== "no-referrer") throw new Error("public report tokens must never leak through referrer headers");

const getter = readFileSync(`${process.cwd()}/supabase/functions/get-vet-report/index.ts`, "utf8");
const records = readFileSync(`${process.cwd()}/apps/mobile/src/contexts/report/application/vetReportRecords.ts`, "utf8");
if (!getter.includes('responseFormat === "json" ? jsonResponse(responseBody) : vetReportTextResponse(responseBody)')) {
  throw new Error("browser share links must default to supported text while explicit JSON requests retain the app contract");
}
if (!records.includes("&format=json")) throw new Error("authenticated app verification must explicitly request the JSON report contract");
if (!getter.includes("payload.disclaimer !== vetReportDisclaimer") || !getter.includes("report.confirmed_by_owner")) {
  throw new Error("text rendering must remain behind confirmation and safety-disclaimer checks");
}
if (!getter.includes('"Cache-Control": "no-store, max-age=0"') || /responseBody\s*=\s*\{\s*id:/s.test(getter)) {
  throw new Error("public JSON must be non-cacheable and must not expose the internal report id");
}
