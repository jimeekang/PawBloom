type Kind = "medication" | "meal";
type Group = { epoch: number; pets: Map<string, object>; tails: Map<string, Promise<void>>; barrier: Promise<void> };
const groups = new Map<string, Group>();
function groupFor(kind: Kind, userId: string) {
  const key = JSON.stringify([kind, userId]);
  let group = groups.get(key);
  if (!group) { group = { epoch: 0, pets: new Map(), tails: new Map(), barrier: Promise.resolve() }; groups.set(key, group); }
  return group;
}
/** Call-entry identity. Network enrichment stays outside the native queue so newer cancels never wait for it. */
export function startReminderReservation(kind: Kind, userId: string, petId: string) {
  const group = groupFor(kind, userId), token = {}, epoch = group.epoch;
  group.pets.set(petId, token);
  const isCurrent = () => group.epoch === epoch && group.pets.get(petId) === token;
  return {
    isCurrent,
    dispose: () => { if (group.pets.get(petId) === token) group.pets.delete(petId); },
    async run<T>(work: () => Promise<T>): Promise<T | false> {
      const previous = group.tails.get(petId) ?? Promise.resolve(), barrier = group.barrier;
      let release!: () => void; const done = new Promise<void>((resolve) => { release = resolve; });
      group.tails.set(petId, done);
      try { await Promise.all([previous, barrier]); return isCurrent() ? await work() : false; }
      finally { release(); if (group.tails.get(petId) === done) group.tails.delete(petId); }
    },
  };
}
/** Reserves an account barrier at entry: later schedules wait until this cancellation finishes. */
export function cancelReminderReservationsForAccount<T>(kind: Kind, userId: string, work: () => Promise<T>): Promise<T> {
  const group = groupFor(kind, userId), previous = [group.barrier, ...group.tails.values()];
  group.epoch++; group.pets.clear();
  let release!: () => void; group.barrier = new Promise<void>((resolve) => { release = resolve; });
  return (async () => { try { await Promise.all(previous); return await work(); } finally { release(); } })();
}
