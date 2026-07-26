import { confirmDestructiveAction } from "../../../design-system/confirmAction";
import { t } from "../../../i18n/translations";

export function confirmAndSignOut(signOut: () => void | Promise<unknown>) {
  return confirmDestructiveAction(
    {
      title: t("auth.signOutTitle"),
      message: t("auth.signOutCopy"),
      cancelText: t("auth.signOutCancel"),
      confirmText: t("auth.signOutConfirm"),
    },
    () => {
      void signOut();
      return true;
    },
  );
}
