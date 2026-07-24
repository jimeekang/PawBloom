export function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
}

export function todayISO(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

// Human display for a YYYY-MM-DD date key; the stored value stays ISO.
export function formatDateKeyDisplay(dateKey: string, language: "ko" | "en"): string {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateKey;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return dateKey;
  if (language === "ko") return `${year}년 ${month}월 ${day}일`;
  return `${EN_MONTHS[month - 1]} ${day}, ${year}`;
}

