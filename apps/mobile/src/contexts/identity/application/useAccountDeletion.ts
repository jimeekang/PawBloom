import { useCallback, useReducer } from "react";
import { supabase } from "../infrastructure/supabaseClient";
import { cancelMedicationRemindersForAccount } from "../../medication/application/medicationReminderNotifications";
import { cancelMealRemindersForAccount } from "../../routine/application/mealReminderNotifications";
import { useAuth } from "./authContext";
import { accountDeletionReducer, initialAccountDeletionState } from "./accountDeletionState";
import type { AccountDeletionResult } from "./authContextTypes";

// Drives the Settings "Delete account" flow: a pure status reducer for the UI
// (idle → confirming → deleting → error) plus the deletion side effect. The
// side effect calls the delete-account edge function (owned-pet Storage purge +
// auth.admin.deleteUser), then mirrors sign-out cleanup by cancelling this
// account's locally scheduled reminders before tearing down the session.
export function useAccountDeletion() {
  const { user, signOut } = useAuth();
  const [state, dispatch] = useReducer(accountDeletionReducer, initialAccountDeletionState);

  const requestConfirm = useCallback(() => dispatch({ type: "request" }), []);
  const cancelConfirm = useCallback(() => dispatch({ type: "cancel" }), []);

  const deleteAccount = useCallback(async (): Promise<AccountDeletionResult> => {
    // Move to "deleting" first so every failure path (including a missing client
    // or session) resolves to the error state; the reducer only accepts `fail`
    // from "deleting".
    dispatch({ type: "start" });
    const client = supabase;
    const userId = user?.id;
    try {
      if (!client || !userId) throw new Error("Account service is not configured.");

      const { error } = await client.functions.invoke("delete-account", { method: "POST" });
      if (error) throw error;

      await cancelMedicationRemindersForAccount(userId).catch(() => undefined);
      await cancelMealRemindersForAccount(userId).catch(() => undefined);
      await signOut().catch(() => undefined);

      dispatch({ type: "succeed" });
      return { ok: true };
    } catch {
      dispatch({ type: "fail" });
      return { ok: false };
    }
  }, [signOut, user?.id]);

  return {
    status: state.status,
    requestConfirm,
    cancelConfirm,
    deleteAccount,
  };
}
