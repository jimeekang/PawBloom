import { finishAccountDeletionLocalBoundary } from "./accountDeletionLocalBoundary";

async function runAccountDeletionLocalBoundaryTests() {
  let activeUserId: string | null = "deleted-user";
  let releaseSdkCleanup: () => void = () => undefined;
  const sdkCleanup = new Promise<void>((resolve) => { releaseSdkCleanup = resolve; });
  const calls: string[] = [];
  const completion = finishAccountDeletionLocalBoundary({
    userId: "deleted-user",
    forceLocalAuthBoundary: (userId) => {
      calls.push(`force:${userId}`);
      if (activeUserId !== userId) return false;
      activeUserId = null;
      return true;
    },
    clearDeletedAccountLocalSession: (userId) => {
      calls.push(`sdk:${userId}`);
      return sdkCleanup;
    },
    purgeOfflineMutations: async () => {
      calls.push("purge");
      throw new Error("persistent storage unavailable");
    },
    cancelMedicationReminders: async () => { calls.push("medication"); },
    cancelMealReminders: async () => { calls.push("meal"); },
  });

  assert(activeUserId === null && calls.join(",") === "force:deleted-user,sdk:deleted-user,purge,medication,meal",
    "the React boundary, targeted SDK cleanup, and local purge must all start before the first async yield");
  activeUserId = "new-user";
  releaseSdkCleanup();
  const result = await completion;
  assert(activeUserId === "new-user" && calls.at(-1) === "force:deleted-user",
    "late deleted-account cleanup must not clear a newly active account");
  assert(result.localCleanupPending,
    "an unverified durable outbox purge must remain observable after authoritative remote deletion");

  let wrongAccountSdkCleanup = false;
  await finishAccountDeletionLocalBoundary({
    userId: "old-user",
    forceLocalAuthBoundary: () => false,
    clearDeletedAccountLocalSession: async () => { wrongAccountSdkCleanup = true; },
    purgeOfflineMutations: async () => undefined,
    cancelMedicationReminders: async () => undefined,
    cancelMealReminders: async () => undefined,
  });
  assert(!wrongAccountSdkCleanup, "deletion must never sign out an account that was already switched");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export default runAccountDeletionLocalBoundaryTests();
