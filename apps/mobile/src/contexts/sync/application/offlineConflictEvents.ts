export type OfflineConflictChangeListener = () => void;

const listeners = new Set<OfflineConflictChangeListener>();

export function subscribeOfflineConflictChanges(listener: OfflineConflictChangeListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishOfflineConflictChange() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // A UI subscriber must not turn a successful replay into a failed sync.
    }
  }
}
