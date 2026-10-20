export type OfflineReplayLeaseResult<T> =
  | { executed: false }
  | { executed: true; value: T };

type ReplayBarrier = {
  blocked: boolean;
  active: number;
  drained: Set<() => void>;
};

const barriers = new Map<string, ReplayBarrier>();

export async function runWithOfflineReplayLease<T>(
  userId: string,
  validate: () => Promise<boolean>,
  task: () => Promise<T>,
): Promise<OfflineReplayLeaseResult<T>> {
  const barrier = barrierFor(userId);
  if (barrier.blocked) return { executed: false };
  barrier.active += 1;
  try {
    if (!await validate() || barrier.blocked) return { executed: false };
    // No await is allowed between this final generation check and invoking
    // the handler. A deletion barrier therefore either blocks this replay
    // or observes it as active and waits for it to drain.
    return { executed: true, value: await task() };
  } finally {
    barrier.active -= 1;
    if (barrier.active === 0) {
      for (const resolve of barrier.drained) resolve();
      barrier.drained.clear();
      if (!barrier.blocked) barriers.delete(userId);
    }
  }
}

export async function blockOfflineReplayForAccount(userId: string) {
  const barrier = barrierFor(userId);
  barrier.blocked = true;
  if (barrier.active === 0) return;
  await new Promise<void>((resolve) => barrier.drained.add(resolve));
}

function barrierFor(userId: string) {
  const existing = barriers.get(userId);
  if (existing) return existing;
  const created: ReplayBarrier = { blocked: false, active: 0, drained: new Set() };
  barriers.set(userId, created);
  return created;
}
