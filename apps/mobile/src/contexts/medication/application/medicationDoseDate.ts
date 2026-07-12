import { useEffect, useState } from "react";

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function millisecondsUntilNextLocalDate(now = new Date()) {
  const next = new Date(now);
  next.setHours(24, 0, 1, 0);
  return Math.max(1, next.getTime() - now.getTime());
}

export function useCurrentLocalDateKey() {
  const [dateKey, setDateKey] = useState(() => localDateKey());
  useEffect(() => {
    const timer = setTimeout(() => setDateKey(localDateKey()), millisecondsUntilNextLocalDate());
    return () => clearTimeout(timer);
  }, [dateKey]);
  return dateKey;
}
