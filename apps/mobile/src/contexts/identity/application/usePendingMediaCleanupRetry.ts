import { useEffect } from "react";
import NetInfo from "@react-native-community/netinfo";
import { AppState } from "react-native";
import { retryPendingMediaCleanup } from "../../media/application/mediaCleanup";
import { supabase } from "../infrastructure/supabaseClient";

export function usePendingMediaCleanupRetry(userId: string | null) {
  useEffect(() => {
    const client = supabase;
    if (!client || !userId) return;

    const retryCleanup = () => void retryPendingMediaCleanup(client);
    retryCleanup();
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") retryCleanup();
    });
    const unsubscribeNetwork = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) retryCleanup();
    });

    return () => {
      appStateSubscription.remove();
      unsubscribeNetwork();
    };
  }, [userId]);
}
