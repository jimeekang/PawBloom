import { getLocalDateKey } from "../../../shared-kernel/date";

export type ReportDateRange = {
  fromDateKey: string;
  toDateKey: string;
};

export function getLast7DayReportRange(anchorDate = new Date()): ReportDateRange {
  return getReportCalendarRange(7, anchorDate);
}

// "Last N days" on the device calendar, inclusive of today — the single window
// definition shared by the draft summary and the generated report (0007 D5).
export function getReportCalendarRange(rangeDays: number, anchorDate = new Date()): ReportDateRange {
  const toDate = new Date(anchorDate);
  toDate.setHours(0, 0, 0, 0);
  const fromDate = addDays(toDate, -(rangeDays - 1));

  return {
    fromDateKey: getLocalDateKey(fromDate),
    toDateKey: getLocalDateKey(toDate),
  };
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
