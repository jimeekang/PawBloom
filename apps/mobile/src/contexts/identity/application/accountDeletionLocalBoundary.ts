type AccountDeletionLocalBoundaryInput = {
  userId: string;
  forceLocalAuthBoundary: (userId: string) => boolean;
  clearDeletedAccountLocalSession: (userId: string) => Promise<void>;
  purgeOfflineMutations: () => Promise<void>;
  cancelMedicationReminders: () => Promise<void>;
  cancelMealReminders: () => Promise<void>;
};

export async function finishAccountDeletionLocalBoundary(input: AccountDeletionLocalBoundaryInput) {
  const deletedAccountWasCurrent = input.forceLocalAuthBoundary(input.userId);
  const sdkSessionCleanup = deletedAccountWasCurrent
    ? startBestEffort(() => input.clearDeletedAccountLocalSession(input.userId))
    : Promise.resolve();
  const localCleanup = Promise.allSettled([
    start(() => input.purgeOfflineMutations()),
    start(() => input.cancelMedicationReminders()),
    start(() => input.cancelMealReminders()),
  ]);

  await sdkSessionCleanup;
  input.forceLocalAuthBoundary(input.userId);
  const [outboxCleanup] = await localCleanup;
  return { localCleanupPending: outboxCleanup?.status === "rejected" };
}

function start(task: () => Promise<void>) {
  try {
    return task();
  } catch (error) {
    return Promise.reject(error);
  }
}

function startBestEffort(task: () => Promise<void>) {
  return start(task).catch(() => undefined);
}
