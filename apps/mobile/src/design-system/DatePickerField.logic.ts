export function parseDateValue(value: string | undefined, fallback = new Date()) {
  if (!value) return fallback;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return fallback;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(fallback);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return fallback;
  return date;
}

export function formatDateValue(date: Date) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
}
