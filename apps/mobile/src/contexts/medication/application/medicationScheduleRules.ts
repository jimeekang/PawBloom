type ScheduleWindow = {
  startsOn: string;
  endsOn?: string;
  recurrenceIntervalDays: number;
};

export function scheduleAppliesOnDate(schedule: ScheduleWindow, dateKey: string) {
  if (dateKey < schedule.startsOn) return false;
  if (schedule.endsOn && dateKey > schedule.endsOn) return false;
  const interval = Math.max(1, Math.floor(schedule.recurrenceIntervalDays || 1));
  return daysBetweenLocalDates(schedule.startsOn, dateKey) % interval === 0;
}

export function daysBetweenLocalDates(fromDateKey: string, toDateKey: string) {
  const from = parseLocalDateKey(fromDateKey);
  const to = parseLocalDateKey(toDateKey);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / millisecondsPerDay);
}

function parseLocalDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}
