import { useEffect } from "react";
import { BackHandler, Platform } from "react-native";
import { getBackNavigation, type AppRoute } from "../navigation/appRoute";
export { getBackNavigation } from "../navigation/appRoute";

export function useAndroidBackNavigation({ route, onBack }: { route: AppRoute; onBack: () => void }) {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!getBackNavigation(route).handled) return false;
      onBack(); return true;
    });
    return () => subscription.remove();
  }, [route, onBack]);
}
