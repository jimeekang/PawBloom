import { useEffect, useState } from "react";
import { subscribeOfflineConflictChanges } from "../application/offlineConflictEvents";
import { countConflictedMutations } from "../application/offlineOutbox";

type ConflictSnapshot = { userId: string | null; count: number };

export function useOfflineConflictCount(userId: string | null) {
  const [snapshot, setSnapshot] = useState<ConflictSnapshot>({ userId: null, count: 0 });

  useEffect(() => {
    let disposed = false;
    let latestRequest = 0;
    setSnapshot({ userId, count: 0 });

    const refresh = () => {
      const request = ++latestRequest;
      if (!userId) return;
      void countConflictedMutations()
        .then((count) => {
          if (!disposed && request === latestRequest) setSnapshot({ userId, count });
        })
        .catch(() => {
          if (!disposed && request === latestRequest) setSnapshot({ userId, count: 0 });
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

  return snapshot.userId === userId ? snapshot.count : 0;
}
