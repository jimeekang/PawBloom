import { displayTimeValue, formatTimeValue, parseTimeValue } from "./TimePickerField.logic";

const fallback = new Date(2026, 5, 30, 8, 30, 0, 0);

const parsed = parseTimeValue("7:05", fallback);
if (formatTimeValue(parsed) !== "07:05") {
  throw new Error("time picker values must normalize one-digit hours");
}

const invalid = parseTimeValue("24:00", fallback);
if (formatTimeValue(invalid) !== "08:30") {
  throw new Error("invalid time picker values must fall back to the provided date");
}

if (formatTimeValue(new Date(2026, 5, 30, 21, 9, 0, 0)) !== "21:09") {
  throw new Error("time picker values must format as HH:mm");
}

if (displayTimeValue("", "미설정") !== "미설정" || displayTimeValue("08:30", "미설정") !== "08:30") {
  throw new Error("empty time picker values must remain visibly unset");
}
