import { useCallback, useReducer } from "react";
import { supabase } from "../infrastructure/supabaseClient";
import { cancelMedicationRemindersForAccount } from "../../medication/application/medicationReminderNotifications";
import { cancelMealRemindersForAccount } from "../../routine/application/mealReminderNotifications";
import { purgeOfflineMutationsForAccount } from "../../sync/application/offlineOutbox";
import { useAuth } from "./authContext";
import { finishAccountDeletionLocalBoundary } from "./accountDeletionLocalBoundary";
import { accountDeletionReducer, initialAccountDeletionState } from "./accountDeletionState";
import type { AccountDeletionResult } from "./authContextTypes";

// Drives the Settings "Delete account" flow: a pure status reducer for the UI
// (idle → confirming → deleting → error) plus the deletion side effect. The
// side effect calls the delete-account edge function (owned-pet Storage purge +
// auth.admin.deleteUser), then mirrors sign-out cleanup by cancelling this
// account's locally scheduled reminders before tearing down the session.
export function useAccountDeletion() {
  const { clearDeletedAccountLocalSession, forceLocalAuthBoundary, announceAccountDeleted } = useAuth();
  const [state, dispatch] = useReducer(accountDeletionReducer, initialAccountDeletionState);

  const requestConfirm = useCallback(() => dispatch({ type: "request" }), []);
  const cancelConfirm = useCallback(() => dispatch({ type: "cancel" }), []);

  const deleteAccount = useCallback(async (): Promise<AccountDeletionResult> => {
    // Move to "deleting" first so every failure path (including a missing client
    // or session) resolves to the error state; the reducer only accepts `fail`
    // from "deleting".
    dispatch({ type: "start" });
    const client = supabase;
    let userId: string;
    try {
      if (!client) throw new Error("Account service is not configured.");

      // Capture the exact JWT subject sent to the Edge Function. The explicit
      // header prevents a simultaneous auth refresh/account boundary from
      // making the local cleanup target differ from the server deletion target.
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      const session = sessionData.session;
      if (sessionError || !session) throw sessionError ?? new Error("Account session is unavailable.");
      userId = session.user.id;

      const { error } = await client.functions.invoke("delete-account", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
    } catch {
      dispatch({ type: "fail" });
      return { ok: false };
    }

    // The server deletion is authoritative at this point. Close the React and
    // query-cache account boundary immediately; SDK local-session cleanup is a
    // secondary best-effort operation and cannot reopen the deleted account.
    const { localCleanupPending } = await finishAccountDeletionLocalBoundary({
      userId,
      forceLocalAuthBoundary,
      clearDeletedAccountLocalSession,
      purgeOfflineMutations: () => purgeOfflineMutationsForAccount(userId),
      cancelMedicationReminders: () => cancelMedicationRemindersForAccount(userId),
      cancelMealReminders: () => cancelMealRemindersForAccount(userId),
    });
    announceAccountDeleted();

    dispatch({ type: "succeed" });
    return { ok: true, localCleanupPending };
  }, [announceAccountDeleted, clearDeletedAccountLocalSession, forceLocalAuthBoundary]);

  return {
    status: state.status,
    requestConfirm,
    cancelConfirm,
    deleteAccount,
  };
}
