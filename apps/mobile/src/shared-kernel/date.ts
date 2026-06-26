export function todayISO(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

