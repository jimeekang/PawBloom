import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { getLocalDateKey } from "./date";

// The local calendar day as state. Screens that captured getLocalDateKey() at
// mount kept yesterday's "today" after midnight (Home recorded to the new day
// while Diary still showed the old one, and the report's 7-day window froze).
// Re-checks on foreground and once a minute; setState with the same key is a
// React bail-out, so idle days cost nothing.
export function useLocalDateKey(): string {
  const [dateKey, setDateKey] = useState(() => getLocalDateKey());

  useEffect(() => {
    const refresh = () => setDateKey(getLocalDateKey());
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    const interval = setInterval(refresh, 60_000);
    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, []);

  return dateKey;
}
