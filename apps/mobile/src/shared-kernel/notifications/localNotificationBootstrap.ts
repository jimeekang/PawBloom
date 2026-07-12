import { Platform } from "react-native";

let configured = false;

export async function configureLocalNotificationPresentation(): Promise<void> {
  if (configured || Platform.OS === "web") return;
  configured = true;

  const Notifications = await import("expo-notifications");
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "PawBloom reminders",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}
