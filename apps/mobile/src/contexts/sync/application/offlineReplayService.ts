import { offlineOutboxStore } from "./offlineOutbox";
import { supabaseOfflineReplayHandlers } from "./offlineReplayHandlers";
import { replayPendingOfflineMutations } from "./offlineReplayQueue";

let replayInFlight: Promise<unknown> | null = null;

export function replayOutboxOnce() {
  if (replayInFlight) return replayInFlight;
  replayInFlight = replayPendingOfflineMutations({
    store: offlineOutboxStore,
    handlers: supabaseOfflineReplayHandlers,
  }).finally(() => {
    replayInFlight = null;
  });
  return replayInFlight;
}
