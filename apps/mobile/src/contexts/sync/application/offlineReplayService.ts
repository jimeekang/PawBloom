import { offlineOutboxStore } from "./offlineOutbox";
import { replayPendingOfflineMutations } from "./offlineReplayQueue";

let replayInFlight: Promise<unknown> | null = null;

export function replayOutboxOnce() {
  if (replayInFlight) return replayInFlight;
  replayInFlight = replayPendingOfflineMutations({
    store: offlineOutboxStore,
  }).finally(() => {
    replayInFlight = null;
  });
  return replayInFlight;
}
