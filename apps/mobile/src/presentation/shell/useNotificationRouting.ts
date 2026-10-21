import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { validateNotificationIdentity } from "../../contexts/pet/application/notificationPetIdentity";
import { createNotificationRouter, type NotificationOpenTarget, type NotificationRoutingScope } from "./notificationRouting";
/** Mounted above app gates so cold responses wait for auth/pet readiness. Listener is installed before last-response lookup. */
export function useNotificationRouting(scope: NotificationRoutingScope) {
  const [target, setTarget] = useState<NotificationOpenTarget | null>(null);
  const router = useRef<ReturnType<typeof createNotificationRouter> | null>(null);
  const latestScope = useRef(scope); latestScope.current = scope;
  useEffect(() => {
    if (Platform.OS === "web") return;
    let mounted = true, remove: (() => void) | undefined;
    const controller = createNotificationRouter(validateNotificationIdentity, setTarget); router.current = controller; controller.updateScope(latestScope.current);
    void import("expo-notifications").then(async (notifications) => {
      if (!mounted) return;
      const receive = (response: import("expo-notifications").NotificationResponse) => {
        controller.receive(response); void notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      };
      const subscription = notifications.addNotificationResponseReceivedListener(receive); remove = () => subscription.remove();
      const last = await notifications.getLastNotificationResponseAsync(); if (mounted && last) receive(last);
    }).catch(() => undefined);
    return () => { mounted = false; remove?.(); controller.dispose(); router.current = null; };
  }, []);
  useEffect(() => { router.current?.updateScope(scope); if (target && (target.userId !== scope.userId || !("kind" in target) && !scope.petIds.includes(target.petId))) setTarget(null); }, [scope.initialized, scope.userId, scope.petsReady, JSON.stringify(scope.petIds)]);
  return { target, consume: () => setTarget(null) };
}
