export function parseTimeValue(value: string, fallback = new Date()) {
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  const date = new Date(fallback);
  if (!match) return date;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return date;
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function formatTimeValue(date: Date) {
  return `${`${date.getHours()}`.padStart(2, "0")}:${`${date.getMinutes()}`.padStart(2, "0")}`;
}
