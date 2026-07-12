import { replaceMedicationDoseInList } from "./medicationDoseRecords";

// Regression: ISSUE-MED-CACHE-001 — an edited medication row disappeared after save.
// Found by /qa on 2026-07-12.
// Report: .gstack/qa-reports/qa-report-localhost-2026-07-12.md
const original = [
  { id: "dose-1", medicationName: "Before", status: "pending" },
  { id: "dose-2", medicationName: "Keep", status: "completed" },
];
const saved = { id: "dose-1", medicationName: "After", status: "partial" };
const updated = replaceMedicationDoseInList(original, saved);

if (updated.length !== 2) throw new Error("medication cache replacement must not remove the edited row");
if (updated[0] !== saved) throw new Error("medication cache replacement must expose the saved server row immediately");
if (updated[1] !== original[1]) throw new Error("medication cache replacement must preserve unrelated rows");

const missing = replaceMedicationDoseInList(original, { id: "dose-missing", medicationName: "Missing", status: "pending" });
if (missing.length !== original.length || missing.some((dose) => dose.id === "dose-missing")) {
  throw new Error("an edited row must not be inserted into unrelated date-range caches when it was not already present");
}
