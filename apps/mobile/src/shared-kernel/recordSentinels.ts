export const DEFAULT_MEDICATION_NAME = "pawbloom:medication:unspecified";

const legacyDefaultMedicationNames = new Set([DEFAULT_MEDICATION_NAME, "Medication", "투약"]);

export function isDefaultMedicationName(value: string | null | undefined) {
  return !value?.trim() || legacyDefaultMedicationNames.has(value.trim());
}

export function normalizeMedicationNameForStorage(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return isDefaultMedicationName(trimmed) ? DEFAULT_MEDICATION_NAME : trimmed;
}
