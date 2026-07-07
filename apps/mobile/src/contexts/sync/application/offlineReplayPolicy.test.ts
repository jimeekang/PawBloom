import type { OfflineMutation } from "../domain/offlineMutation";
import { registerOfflineReplayHandler, replayOfflineMutation } from "./offlineReplayPolicy";

function buildMutation(aggregate: string, operation: OfflineMutation["operation"]): OfflineMutation {
  return {
    id: `offline-${aggregate}-1`,
    clientMutationId: `${aggregate}-1`,
    aggregate,
    operation,
    payload: { petId: "pet-1" },
    createdAt: "2026-07-05T01:00:00.000Z",
    attempts: 0,
  };
}

export default runReplayPolicyTests();

async function runReplayPolicyTests() {
  let handledClientMutationId = "";
  registerOfflineReplayHandler("policy-test", "insert", async (mutation) => {
    handledClientMutationId = mutation.clientMutationId;
    return { status: "applied", reason: "policy test replayed" };
  });

  const dispatched = await replayOfflineMutation(buildMutation("policy-test", "insert"));
  if (dispatched.status !== "applied" || handledClientMutationId !== "policy-test-1") {
    throw new Error("replay must dispatch to the handler registered for the aggregate and operation");
  }

  const unsupported = await replayOfflineMutation(buildMutation("policy-test", "delete"));
  if (unsupported.status !== "unsupported" || !unsupported.reason.includes("policy-test.delete")) {
    throw new Error("replay without a registered handler must report the mutation as unsupported");
  }

  registerOfflineReplayHandler("policy-conflict", "update", async () => ({ status: "conflict", reason: "changed on another device" }));
  const conflicted = await replayOfflineMutation(buildMutation("policy-conflict", "update"));
  if (conflicted.status !== "conflict") {
    throw new Error("replay must pass handler conflict results through unchanged");
  }
}
