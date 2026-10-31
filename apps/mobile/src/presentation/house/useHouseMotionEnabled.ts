import { useEffect, useState } from "react";
import { AccessibilityInfo, AppState, type AppStateStatus } from "react-native";
export type HouseMotionConditions = { tabVisible: boolean; appState: AppStateStatus | null; reduceMotion: boolean; userPaused: boolean };
export function isHouseMotionEnabled({ tabVisible, appState, reduceMotion, userPaused }: HouseMotionConditions): boolean { return tabVisible && appState === "active" && !reduceMotion && !userPaused; }
/** Unknown OS preference fails closed. Every listener is removed on unmount. */
export function useHouseMotionState(tabVisible: boolean, userPaused: boolean) {
  const [appState, setAppState] = useState<AppStateStatus | null>(AppState.currentState);
  const [reduceMotion, setReduceMotion] = useState(true);
  // False until the OS answers (or fails): one-shot reactions wait so the fail-closed default cannot consume them.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    let mounted = true, revision = 0;
    const app = AppState.addEventListener("change", setAppState);
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => { revision++; setReduceMotion(value); setSettled(true); });
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (mounted && revision === 0) setReduceMotion(value); }).catch(() => undefined).finally(() => { if (mounted) setSettled(true); });
    return () => { mounted = false; app.remove(); motion.remove(); };
  }, []);
  return { enabled: isHouseMotionEnabled({ tabVisible, appState, reduceMotion, userPaused }), reduced: reduceMotion, settled, active: tabVisible && appState === "active" };
}

export function useHouseMotionEnabled(tabVisible: boolean, userPaused: boolean): boolean { return useHouseMotionState(tabVisible, userPaused).enabled; }
