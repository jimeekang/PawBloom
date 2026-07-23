import { formatDateDisplay, formatDateValue, parseDateValue } from "./DatePickerField.logic";

if (formatDateDisplay("2026-07-23", "ko") !== "2026년 7월 23일") {
  throw new Error("Korean date display must use year/month/day words without zero padding");
}
if (formatDateDisplay("2026-07-04", "en") !== "Jul 4, 2026") {
  throw new Error("English date display must use abbreviated month format");
}
if (formatDateDisplay("not-a-date", "en") !== "not-a-date" || formatDateDisplay("2026-13-01", "ko") !== "2026-13-01") {
  throw new Error("unparseable values must fall back to the raw string instead of throwing");
}

const roundTrip = formatDateValue(parseDateValue("2026-01-31"));
if (roundTrip !== "2026-01-31") {
  throw new Error("parse/format round trip must preserve the ISO date key");
}
