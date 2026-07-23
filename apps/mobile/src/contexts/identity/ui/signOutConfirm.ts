import { confirmDestructiveAction } from "../../../design-system/confirmAction";
import { t } from "../../../i18n/translations";

export function confirmAndSignOut(signOut: () => void | Promise<unknown>) {
  return confirmDestructiveAction(
    {
      title: t("ko", "auth.signOutTitle"),
      message: t("ko", "auth.signOutCopy"),
      cancelText: t("ko", "auth.signOutCancel"),
      confirmText: t("ko", "auth.signOutConfirm"),
    },
    () => {
      void signOut();
      return true;
    },
  );
}
