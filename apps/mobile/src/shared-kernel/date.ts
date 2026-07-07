export function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
}

export function todayISO(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

