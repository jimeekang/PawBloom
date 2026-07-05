import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";
import { replayOutboxOnce } from "./offlineReplayService";

let configured = false;

export function configureNetworkSync() {
  if (configured) {
    return;
  }

  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected) && state.isInternetReachable !== false;
      setOnline(online);
      if (online) void replayOutboxOnce();
    }),
  );
  configured = true;
  void replayOutboxOnce();
}
