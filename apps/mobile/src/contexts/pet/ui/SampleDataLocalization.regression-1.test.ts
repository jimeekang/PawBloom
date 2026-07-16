import { buildSampleBrief } from "../../briefing/ui/sampleBrief";
import { buildSampleDiaryEntries, relocalizeSampleDiaryEntries } from "../../diary/ui/sampleDiaryEntries";
import { buildSampleDoses, relocalizeSampleDoses } from "../../medication/ui/sampleDoses";
import { buildSampleReport } from "../../report/ui/sampleReport";
import { buildSamplePets } from "./samplePets";

// Regression: UX-009 — English preview retained Korean pet, diary, and medication fixtures
// Found by /qa on 2026-07-16
// Report: .gstack/qa-reports/qa-report-pawbloom-ui-ux-2026-07-16.md

const hangul = /[가-힣]/;
const englishPets = buildSamplePets("en");
const englishEntries = buildSampleDiaryEntries(englishPets[0].id, "en");
const englishDoses = buildSampleDoses(englishPets[0].id, "en");
const englishBrief = buildSampleBrief(englishPets[0].id, "en");
const englishReport = buildSampleReport(englishPets[0].id, "en");

const englishFixtureText = [
  ...englishPets.flatMap((pet) => [pet.name, pet.breed, pet.ageLabel]),
  ...englishEntries.map((entry) => entry.summary),
  ...englishDoses.flatMap((dose) => [dose.medicationName, dose.reactionNote ?? ""]),
  ...englishBrief.highlights,
  ...englishBrief.questionsForVet,
  englishBrief.disclaimer,
  englishReport.disclaimer,
].join(" ");

if (hangul.test(englishFixtureText)) {
  throw new Error("English preview fixtures must not contain Korean copy");
}

const localizedEntries = relocalizeSampleDiaryEntries(buildSampleDiaryEntries("pet-demo", "ko"), "en");
if (localizedEntries[0].summary !== "Ate half of breakfast") {
  throw new Error("untouched sample Diary records must follow the selected language");
}

const editedEntries = buildSampleDiaryEntries("pet-demo", "ko");
editedEntries[0] = { ...editedEntries[0], summary: "Custom owner note" };
if (relocalizeSampleDiaryEntries(editedEntries, "en")[0].summary !== "Custom owner note") {
  throw new Error("language changes must not overwrite an edited Diary sample");
}

const editedDoses = buildSampleDoses("pet-demo", "ko");
editedDoses[0] = { ...editedDoses[0], reactionNote: "Custom reaction note" };
const localizedDoses = relocalizeSampleDoses(editedDoses, "en");
if (localizedDoses[0].medicationName !== "Probiotic" || localizedDoses[0].reactionNote !== "Custom reaction note") {
  throw new Error("sample medication names may localize, but user-edited notes must remain unchanged");
}
