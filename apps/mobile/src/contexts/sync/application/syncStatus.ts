import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";

let configured = false;

export function configureNetworkSync() {
  if (configured) {
    return;
  }

  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected));
    }),
  );
  configured = true;
}

