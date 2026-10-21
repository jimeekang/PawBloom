import { useEffect, useState } from "react";
import { AccessibilityInfo, AppState, type AppStateStatus } from "react-native";
export type HouseMotionConditions = { tabVisible: boolean; appState: AppStateStatus | null; reduceMotion: boolean; userPaused: boolean };
export function isHouseMotionEnabled({ tabVisible, appState, reduceMotion, userPaused }: HouseMotionConditions): boolean { return tabVisible && appState === "active" && !reduceMotion && !userPaused; }
/** Unknown OS preference fails closed. Every listener is removed on unmount. */
export function useHouseMotionEnabled(tabVisible: boolean, userPaused: boolean): boolean {
  const [appState, setAppState] = useState<AppStateStatus | null>(AppState.currentState);
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let mounted = true, revision = 0;
    const app = AppState.addEventListener("change", setAppState);
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => { revision++; setReduceMotion(value); });
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (mounted && revision === 0) setReduceMotion(value); }).catch(() => undefined);
    return () => { mounted = false; app.remove(); motion.remove(); };
  }, []);
  return isHouseMotionEnabled({ tabVisible, appState, reduceMotion, userPaused });
}
