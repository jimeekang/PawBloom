import { useEffect, useState } from "react";
import { subscribeOfflineConflictChanges } from "../application/offlineConflictEvents";
import { listConflictedMutations } from "../application/offlineOutbox";
import { offlineConflictMetadata } from "../application/offlineReplayQueue";
import type { OfflineConflictMetadata } from "../domain/offlineConflict";

type ConflictSnapshot = { userId: string | null; conflicts: OfflineConflictMetadata[] };

export function useOfflineConflicts(userId: string | null) {
  const [snapshot, setSnapshot] = useState<ConflictSnapshot>({ userId: null, conflicts: [] });

  useEffect(() => {
    let disposed = false;
    let latestRequest = 0;
    setSnapshot({ userId, conflicts: [] });

    const refresh = () => {
      const request = ++latestRequest;
      if (!userId) return;
      void listConflictedMutations()
        .then((conflicts) => {
          if (!disposed && request === latestRequest) setSnapshot({ userId, conflicts: conflicts.map(offlineConflictMetadata) });
        })
        .catch(() => {
          if (!disposed && request === latestRequest) setSnapshot({ userId, conflicts: [] });
        });
    };

    const unsubscribe = subscribeOfflineConflictChanges(refresh);
    refresh();
    return () => {
      disposed = true;
      latestRequest += 1;
      unsubscribe();
    };
  }, [userId]);

  return snapshot.userId === userId ? snapshot.conflicts : [];
}
