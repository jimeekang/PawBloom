import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { confirmDestructiveAction } from "../../../design-system/confirmAction";
import { NoticeBanner, SecondaryButton } from "../../../design-system/components";
import { spacing } from "../../../design-system/tokens";
import { t } from "../../../i18n/translations";
import { clearCurrentUserOfflineConflicts } from "../application/offlineConflictResolution";
import { useOfflineConflictCount } from "./useOfflineConflictCount";

export function OfflineConflictNotice({ userId }: { userId: string | null }) {
  const count = useOfflineConflictCount(userId);
  const [clearing, setClearing] = useState(false);
  const [clearFailed, setClearFailed] = useState(false);

  if (!userId || count === 0) return null;
  const notice = t("ko", "sync.conflictsNeedAttention").replace("{count}", String(count));

  async function clearReviewedConflicts() {
    setClearing(true);
    setClearFailed(false);
    try {
      await clearCurrentUserOfflineConflicts(userId!);
      return true;
    } catch {
      setClearFailed(true);
      return false;
    } finally {
      setClearing(false);
    }
  }

  function confirmClear() {
    void confirmDestructiveAction({
      title: t("ko", "sync.clearConflictsTitle"),
      message: t("ko", "sync.clearConflictsCopy"),
      cancelText: t("ko", "sync.clearConflictsCancel"),
      confirmText: t("ko", "sync.clearConflictsConfirm"),
    }, clearReviewedConflicts);
  }

  return (
    <View style={styles.container}>
      <NoticeBanner text={notice} icon="shield" />
      {clearFailed ? <NoticeBanner text={t("ko", "sync.clearConflictsFailed")} icon="shield" /> : null}
      <SecondaryButton
        label={t("ko", clearing ? "sync.clearingConflicts" : "sync.clearReviewedConflicts")}
        icon="close"
        onPress={confirmClear}
        disabled={clearing}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
});
