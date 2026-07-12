export const vetReportDisclaimer = "This is a record-based summary, not a diagnosis. Contact a veterinarian for medical decisions.";

export type VetReportDisplayField = { label: string; value: string };

export type NormalizedVetReportEntry = {
  category: "food" | "water" | "walk" | "stool" | "condition" | "memo" | "photo";
  summary: string;
  memo: string | null;
  details: VetReportDisplayField[];
  occurredAt: string;
  conditionScore: number | null;
};

export type NormalizedVetReportDose = {
  medicationName: string;
  status: "pending" | "completed" | "partial" | "skipped";
  scheduledAt: string;
  conditionName: string | null;
  dosageLabel: string | null;
  administeredAmount: string | null;
  reactionNote: string | null;
};

export function buildNormalizedVetReportPayload(pet: unknown, entries: unknown[], medicationDoses: unknown[]) {
  return {
    version: 1 as const,
    pet: normalizePet(pet),
    entries: entries.map(normalizeDiaryEntry),
    medicationDoses: medicationDoses.map(normalizeMedicationDose),
    disclaimer: vetReportDisclaimer,
  };
}

export function sanitizeStoredVetReportPayload(value: unknown) {
  const payload = asRecord(value);
  if (payload.version !== 1 || payload.disclaimer !== vetReportDisclaimer) {
    throw new Error("Stored report payload is invalid");
  }
  const storedPet = asOptionalRecord(payload.pet);
  return {
    version: 1 as const,
    pet: storedPet ? {
      name: safeDisplayText(storedPet.name),
      species: safeDisplayText(storedPet.species),
      breed: nullableSafeDisplayText(storedPet.breed),
      weightKg: finiteNumber(storedPet.weightKg),
    } : null,
    entries: array(payload.entries).map((entryValue) => {
      const entry = asRecord(entryValue);
      return {
        category: diaryCategory(entry.category),
        summary: safeDisplayText(entry.summary),
        memo: nullableSafeDisplayText(entry.memo),
        details: array(entry.details).map((detailValue) => {
          const detail = asRecord(detailValue);
          return { label: safeDisplayText(detail.label), value: safeDisplayText(detail.value) };
        }).filter((detail) => detail.label && detail.value),
        occurredAt: text(entry.occurredAt),
        conditionScore: conditionScore(entry.conditionScore),
      };
    }),
    medicationDoses: array(payload.medicationDoses).map((doseValue) => {
      const dose = asRecord(doseValue);
      return {
        medicationName: safeDisplayText(dose.medicationName) || "Medication",
        status: doseStatus(dose.status),
        scheduledAt: text(dose.scheduledAt),
        conditionName: nullableSafeDisplayText(dose.conditionName),
        dosageLabel: nullableSafeDisplayText(dose.dosageLabel),
        administeredAmount: nullableSafeDisplayText(dose.administeredAmount),
        reactionNote: nullableSafeDisplayText(dose.reactionNote),
      };
    }),
    disclaimer: vetReportDisclaimer,
  };
}

export function normalizeDiaryEntry(value: unknown): NormalizedVetReportEntry {
  const row = asRecord(value);
  const category = diaryCategory(row.category);
  const decoded = decodeDiarySummary(text(row.summary), category);
  return {
    category,
    summary: decoded.summary,
    memo: decoded.memo,
    details: decoded.details,
    occurredAt: text(row.occurred_at),
    conditionScore: conditionScore(row.condition_score),
  };
}

export function normalizeMedicationDose(value: unknown): NormalizedVetReportDose {
  const row = asRecord(value);
  const careNote = decodeMedicationCareNote(nullableText(row.reaction_note));
  return {
    medicationName: text(row.medication_name) || "Medication",
    status: doseStatus(row.status),
    scheduledAt: text(row.scheduled_at),
    conditionName: careNote.conditionName,
    dosageLabel: careNote.dosageLabel,
    administeredAmount: careNote.administeredAmount,
    reactionNote: careNote.reactionNote,
  };
}

function normalizePet(value: unknown) {
  if (!value) return null;
  const row = asRecord(value);
  return {
    name: text(row.name) || "Pet",
    species: text(row.species) || "unknown",
    breed: nullableText(row.breed),
    weightKg: finiteNumber(row.weight_kg),
  };
}

function decodeDiarySummary(rawSummary: string, category: NormalizedVetReportEntry["category"]) {
  const parsed = parseRecord(rawSummary);
  if (!parsed || parsed.version !== 1 || !asOptionalRecord(parsed.detail)) {
    const safeSummary = parsed ? `${categoryLabel(category)} record` : rawSummary.trim() || `${categoryLabel(category)} record`;
    return { summary: safeSummary, memo: null, details: [] as VetReportDisplayField[] };
  }
  const detail = asRecord(parsed.detail);
  const memo = nullableText(parsed.memo);
  const details = diaryDetailFields(detail);
  const summaryParts = [...details.map((field) => `${field.label}: ${field.value}`), ...(memo ? [`Note: ${memo}`] : [])];
  return { summary: summaryParts.join("; ") || `${categoryLabel(category)} record`, memo, details };
}

function diaryDetailFields(detail: Record<string, unknown>): VetReportDisplayField[] {
  const category = text(detail.category);
  if (category === "food") {
    const meals = asRecord(detail.meals);
    const fields = ["breakfast", "lunch", "dinner", "snack"].flatMap((slot) => {
      const meal = asRecord(meals[slot]);
      const offered = nullableText(meal.offeredGrams);
      const eaten = nullableText(meal.eatenGrams);
      return offered || eaten ? [field(titleCase(slot), `${eaten ?? "-"} g eaten / ${offered ?? "-"} g offered`)] : [];
    });
    return append(fields, "Appetite", enumLabel(detail.appetite, { good: "Good", normal: "Normal", low: "Low", refused: "Refused" }));
  }
  if (category === "water") return compactFields([
    optionalField("Amount", nullableText(detail.amountMl), " ml"),
    optionalField("Intake", enumLabel(detail.intakeLevel, { less: "Less", normal: "Normal", more: "More" })),
  ]);
  if (category === "walk") return compactFields([
    optionalField("Duration", nullableText(detail.durationMinutes), " minutes"),
    optionalField("Intensity", enumLabel(detail.intensity, { low: "Low", normal: "Normal", high: "High" })),
    optionalField("Stool observation", nullableText(detail.stoolObservation)),
    optionalField("Urine observation", nullableText(detail.urineObservation)),
    optionalField("Symptoms", nullableText(detail.symptomNote)),
    optionalField("Walk note", nullableText(detail.observation)),
  ]);
  if (category === "stool") return compactFields([
    optionalField("Count", nullableText(detail.count)),
    optionalField("Consistency", enumLabel(detail.consistency, { normal: "Normal", soft: "Soft", diarrhea: "Diarrhea", hard: "Hard" })),
    typeof detail.hasBloodOrMucus === "boolean" ? field("Blood or mucus", detail.hasBloodOrMucus ? "Observed" : "Not observed") : null,
  ]);
  if (category === "condition") return compactFields([
    optionalField("Energy", enumLabel(detail.energyLevel, { less: "Low", normal: "Normal", more: "High" })),
    optionalField("Discomfort", nullableText(detail.discomfortNote)),
  ]);
  return [];
}

function decodeMedicationCareNote(value: string | null) {
  const empty = { conditionName: null, dosageLabel: null, administeredAmount: null, reactionNote: null };
  if (!value) return empty;
  const parsed = parseRecord(value);
  if (!parsed) return { ...empty, reactionNote: value.trim() || null };
  if (parsed.version !== 1) return empty;
  return {
    conditionName: nullableText(parsed.conditionName),
    dosageLabel: nullableText(parsed.dosageLabel),
    administeredAmount: nullableText(parsed.administeredAmount),
    reactionNote: nullableText(parsed.reactionNote),
  };
}

function diaryCategory(value: unknown): NormalizedVetReportEntry["category"] {
  return value === "food" || value === "water" || value === "walk" || value === "stool" || value === "condition" || value === "photo" ? value : "memo";
}
function doseStatus(value: unknown): NormalizedVetReportDose["status"] { return value === "completed" || value === "partial" || value === "skipped" ? value : "pending"; }
function conditionScore(value: unknown) { const score = finiteNumber(value); return score !== null && score >= 1 && score <= 5 ? score : null; }
function categoryLabel(value: string) { return titleCase(value); }
function field(label: string, value: string): VetReportDisplayField { return { label, value }; }
function optionalField(label: string, value: string | null, suffix = "") { return value ? field(label, `${value}${suffix}`) : null; }
function compactFields(values: Array<VetReportDisplayField | null>) { return values.filter((value): value is VetReportDisplayField => Boolean(value)); }
function append(values: VetReportDisplayField[], label: string, value: string | null) { return value ? [...values, field(label, value)] : values; }
function enumLabel(value: unknown, labels: Record<string, string>) { const key = nullableText(value); return key ? labels[key] ?? titleCase(key) : null; }
function titleCase(value: string) { return value ? `${value[0]?.toUpperCase()}${value.slice(1)}` : value; }
function text(value: unknown) { return typeof value === "string" ? value : ""; }
function nullableText(value: unknown) { const valueText = text(value).trim(); return valueText || null; }
function safeDisplayText(value: unknown) { const valueText = text(value).trim(); return parseJsonContainer(valueText) ? "" : valueText; }
function nullableSafeDisplayText(value: unknown) { return safeDisplayText(value) || null; }
function finiteNumber(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function asRecord(value: unknown): Record<string, unknown> { return asOptionalRecord(value) ?? {}; }
function asOptionalRecord(value: unknown): Record<string, unknown> | null { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function parseRecord(value: string) { try { return asOptionalRecord(JSON.parse(value)); } catch { return null; } }
function parseJsonContainer(value: string) { try { const parsed = JSON.parse(value); return parsed !== null && typeof parsed === "object"; } catch { return false; } }
