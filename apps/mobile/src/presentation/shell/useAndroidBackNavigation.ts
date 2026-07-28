import { useEffect } from "react";
import { BackHandler, Platform } from "react-native";
import type { MainTab } from "../ui/BottomNav";

// Android hardware back: close the pet-settings overlay, then return to the
// home tab, before letting the OS exit the app (0007 E7). Without this, back
// exited the app from any non-home tab and from inside pet settings.
export function useAndroidBackNavigation({ activeTab, showPetSettings, setActiveTab, closePetSettings }: {
  activeTab: MainTab;
  showPetSettings: boolean;
  setActiveTab: (tab: MainTab) => void;
  closePetSettings: () => void;
}) {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showPetSettings) { closePetSettings(); return true; }
      if (activeTab !== "today") { setActiveTab("today"); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [activeTab, closePetSettings, setActiveTab, showPetSettings]);
}
