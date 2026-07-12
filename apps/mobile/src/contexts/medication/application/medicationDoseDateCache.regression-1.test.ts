import { localDateKey, medicationDoseKeys, millisecondsUntilNextLocalDate } from "./medicationDoseRecords";

// Regression: ISSUE-MED-DATE-003 — yesterday's cached dose was reused after midnight.
// Found by /qa on 2026-07-12.
// Report: .gstack/qa-reports/qa-report-localhost-2026-07-12.md
const beforeMidnight = new Date(2026, 6, 12, 23, 59, 59, 500);
const nextDate = new Date(2026, 6, 13, 0, 0, 1, 0);

if (localDateKey(beforeMidnight) !== "2026-07-12" || localDateKey(nextDate) !== "2026-07-13") {
  throw new Error("local medication date keys must follow the device calendar date");
}

const todayKey = medicationDoseKeys.today("pet-1", "2026-07-12");
const tomorrowKey = medicationDoseKeys.today("pet-1", "2026-07-13");
if (JSON.stringify(todayKey) === JSON.stringify(tomorrowKey)) {
  throw new Error("today medication cache keys must include the local date");
}

const delay = millisecondsUntilNextLocalDate(beforeMidnight);
if (delay < 1_000 || delay > 2_000) {
  throw new Error(`midnight refresh must be scheduled just after the next local day begins, received ${delay}ms`);
}
