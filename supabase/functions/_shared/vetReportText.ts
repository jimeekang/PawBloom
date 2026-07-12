import { vetReportDisclaimer } from "./vetReportArtifact.ts";

type TextReport = {
  rangeDays: number;
  status: string;
  englishSummary: string;
  payload: unknown;
  createdAt: string;
};

export function vetReportTextResponse(report: TextReport) {
  return new Response(renderVetReportText(report), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'inline; filename="pawbloom-vet-report.txt"',
      "Cache-Control": "no-store, max-age=0",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; sandbox",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}

export function renderVetReportText(report: TextReport) {
  const payload = asRecord(report.payload);
  const pet = asOptionalRecord(payload.pet);
  const entries = array(payload.entries).map(asRecord);
  const doses = array(payload.medicationDoses).map(asRecord);
  const petName = lineText(pet?.name) || "Pet";
  const lines = [
    "PAWBLOOM VETERINARY CARE REPORT",
    "================================",
    `Pet: ${petName}`,
    `Species: ${lineText(pet?.species) || "Not recorded"}`,
    `Breed: ${lineText(pet?.breed) || "Not recorded"}`,
    `Weight: ${weightText(pet?.weightKg)}`,
    `Range: Last ${report.rangeDays} days`,
    `Created: ${formatTimestamp(report.createdAt)}`,
    `Status: ${lineText(report.status)}`,
    "",
    "SUMMARY",
    "-------",
    lineText(report.englishSummary),
    "",
    `DIARY RECORDS (${entries.length})`,
    "----------------",
    ...(entries.length ? entries.flatMap(renderDiaryEntry) : ["No diary records in this report."]),
    "",
    `MEDICATION RECORDS (${doses.length})`,
    "----------------------",
    ...(doses.length ? doses.flatMap(renderMedicationDose) : ["No medication records in this report."]),
    "",
    "IMPORTANT SAFETY NOTE",
    "---------------------",
    vetReportDisclaimer,
    "",
  ];
  return lines.join("\n");
}

function renderDiaryEntry(entry: Record<string, unknown>, index: number) {
  const lines = [
    `${index + 1}. ${titleCase(lineText(entry.category) || "Diary")} — ${formatTimestamp(lineText(entry.occurredAt))}`,
    `   ${lineText(entry.summary) || "No details recorded."}`,
  ];
  for (const detailValue of array(entry.details)) {
    const detail = asRecord(detailValue);
    const label = lineText(detail.label), value = lineText(detail.value);
    if (label && value) lines.push(`   ${label}: ${value}`);
  }
  const score = finiteNumber(entry.conditionScore);
  if (score !== null) lines.push(`   Condition score: ${score}/5`);
  return [...lines, ""];
}

function renderMedicationDose(dose: Record<string, unknown>, index: number) {
  const lines = [
    `${index + 1}. ${lineText(dose.medicationName) || "Medication"} — ${formatTimestamp(lineText(dose.scheduledAt))}`,
    `   Status: ${lineText(dose.status) || "unknown"}`,
  ];
  for (const [label, value] of [
    ["Condition", dose.conditionName],
    ["Prescribed", dose.dosageLabel],
    ["Given", dose.administeredAmount],
    ["Reaction / note", dose.reactionNote],
  ] as const) {
    const valueText = lineText(value);
    if (valueText) lines.push(`   ${label}: ${valueText}`);
  }
  return [...lines, ""];
}

function weightText(value: unknown) { const weight = finiteNumber(value); return weight === null ? "Not recorded" : `${weight} kg`; }
function formatTimestamp(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? lineText(value) || "Time not recorded" : date.toISOString().replace("T", " ").replace(".000Z", " UTC"); }
function titleCase(value: string) { return value ? `${value[0]?.toUpperCase()}${value.slice(1)}` : value; }
function lineText(value: unknown) { return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]+/g, " ").replace(/</g, "‹").replace(/>/g, "›").replace(/\s+/g, " ").trim() : typeof value === "number" ? String(value) : ""; }
function finiteNumber(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function asRecord(value: unknown): Record<string, unknown> { return asOptionalRecord(value) ?? {}; }
function asOptionalRecord(value: unknown): Record<string, unknown> | null { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
