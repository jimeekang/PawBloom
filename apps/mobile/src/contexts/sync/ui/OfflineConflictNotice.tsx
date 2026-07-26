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
  const notice = t("sync.conflictsNeedAttention").replace("{count}", String(count));

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
      title: t("sync.clearConflictsTitle"),
      message: t("sync.clearConflictsCopy"),
      cancelText: t("sync.clearConflictsCancel"),
      confirmText: t("sync.clearConflictsConfirm"),
    }, clearReviewedConflicts);
  }

  return (
    <View style={styles.container}>
      <NoticeBanner text={notice} icon="shield" />
      {clearFailed ? <NoticeBanner text={t("sync.clearConflictsFailed")} icon="shield" tone="error" /> : null}
      <SecondaryButton
        label={t(clearing ? "sync.clearingConflicts" : "sync.clearReviewedConflicts")}
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
