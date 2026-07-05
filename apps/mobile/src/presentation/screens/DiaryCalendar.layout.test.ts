import { createMonthWeeks } from "./DiaryCalendar";

const weeks = createMonthWeeks(new Date(2026, 5, 27));

const weekCount = weeks.length;
const dayCount = weeks[0]?.length ?? 0;
const firstWeek = weeks[0]?.map((day) => day.dayLabel).join(",");

if (dayCount !== 7) {
  throw new Error("calendar weeks must always contain seven day cells");
}

if (firstWeek !== "1,2,3,4,5,6,7") {
  throw new Error("June 2026 must align Monday through Sunday in the first row");
}

void weekCount;
