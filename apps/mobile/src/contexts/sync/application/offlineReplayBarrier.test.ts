import { blockOfflineReplayForAccount, runWithOfflineReplayLease } from "./offlineReplayBarrier";

async function runOfflineReplayBarrierTests() {
  let releaseActive: () => void = () => undefined;
  let signalStarted: () => void = () => undefined;
  const activeReleased = new Promise<void>((resolve) => { releaseActive = resolve; });
  const activeStarted = new Promise<void>((resolve) => { signalStarted = resolve; });
  let activeFinished = false;

  const activeReplay = runWithOfflineReplayLease(
    "barrier-user",
    async () => true,
    async () => {
      signalStarted();
      await activeReleased;
      activeFinished = true;
      return "applied";
    },
  );
  await activeStarted;

  let purgeFinished = false;
  const purgeBarrier = blockOfflineReplayForAccount("barrier-user").then(() => {
    purgeFinished = true;
  });
  const blockedReplay = await runWithOfflineReplayLease(
    "barrier-user",
    async () => true,
    async () => "must-not-run",
  );
  assert(!blockedReplay.executed && !purgeFinished,
    "deletion must block new replay while it waits for an already active handler");

  releaseActive();
  const activeResult = await activeReplay;
  await purgeBarrier;
  assert(activeResult.executed && activeResult.value === "applied" && activeFinished && purgeFinished,
    "deletion may proceed only after the active remote handler drains");

  const laterReplay = await runWithOfflineReplayLease(
    "barrier-user",
    async () => true,
    async () => "must-not-run",
  );
  assert(!laterReplay.executed, "a deleted account's replay barrier must remain closed");

  const otherUserReplay = await runWithOfflineReplayLease(
    "other-barrier-user",
    async () => true,
    async () => "safe",
  );
  assert(otherUserReplay.executed && otherUserReplay.value === "safe",
    "one account's deletion barrier must not block another account");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export default runOfflineReplayBarrierTests();
