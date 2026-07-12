declare const require: (moduleName: string) => unknown;

const { buildNormalizedVetReportPayload, sanitizeStoredVetReportPayload } = require("../../../../../../supabase/functions/_shared/vetReportArtifact.ts") as {
  buildNormalizedVetReportPayload(pet: unknown, entries: unknown[], doses: unknown[]): {
    version: 1;
    entries: Array<{ summary: string; memo: string | null; details: Array<{ label: string; value: string }> }>;
    medicationDoses: Array<{ conditionName: string | null; dosageLabel: string | null; administeredAmount: string | null; reactionNote: string | null }>;
  };
  sanitizeStoredVetReportPayload(value: unknown): Record<string, unknown> & { entries: Array<Record<string, unknown>> };
};

const payload = buildNormalizedVetReportPayload(
  { name: "Mochi", species: "dog", breed: "Shiba", weight_kg: 9.2 },
  [{
    category: "food",
    summary: JSON.stringify({ version: 1, category: "food", memo: "ate slowly", detail: { category: "food", meals: { breakfast: { offeredGrams: "100", eatenGrams: "80" } }, appetite: "low" } }),
    occurred_at: "2026-07-12T08:00:00.000Z",
    condition_score: null,
  }],
  [{
    medication_name: "Cerenia",
    status: "partial",
    scheduled_at: "2026-07-12T09:00:00.000Z",
    reaction_note: JSON.stringify({ version: 1, conditionName: "Nausea", dosageLabel: "16 mg", administeredAmount: "8 mg", reactionNote: "Sleepy" }),
  }],
);

const entry = payload.entries[0];
if (payload.version !== 1 || !entry || entry.memo !== "ate slowly") throw new Error("structured diary JSON must be decoded before the immutable report payload is persisted");
if (!entry.summary.includes("Breakfast: 80 g eaten / 100 g offered") || !entry.summary.includes("Appetite: Low")) {
  throw new Error("normalized diary display summary must retain structured meal and appetite values");
}
if (entry.summary.includes('{"version"') || entry.details.length < 2) throw new Error("normalized diary display fields must not contain nested JSON text");

const dose = payload.medicationDoses[0];
if (!dose || dose.conditionName !== "Nausea" || dose.dosageLabel !== "16 mg" || dose.administeredAmount !== "8 mg" || dose.reactionNote !== "Sleepy") {
  throw new Error("structured medication care-note JSON must become typed report display fields");
}
if (Object.values(dose).some((value) => typeof value === "string" && value.includes('{"version"'))) {
  throw new Error("normalized medication display fields must not contain nested JSON text");
}

const publicPayload = sanitizeStoredVetReportPayload({
  ...payload,
  internalOwnerId: "must-not-leak",
  entries: [{ ...payload.entries[0], rawRow: { created_by: "must-not-leak" }, memo: '{"secret":"must-not-leak"}' }],
});
const publicEntry = publicPayload.entries[0];
if (!publicEntry || "internalOwnerId" in publicPayload || "rawRow" in publicEntry || publicEntry.memo !== null) {
  throw new Error("public report payload sanitization must whitelist fields and drop encoded internal objects");
}
