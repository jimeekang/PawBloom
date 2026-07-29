import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { confirmDestructiveAction } from "../../../design-system/confirmAction";
import { NoticeBanner, SecondaryButton } from "../../../design-system/components";
import { colors, radius, spacing, type } from "../../../design-system/tokens";
import { t, type TranslationKey } from "../../../i18n/translations";
import { clearCurrentUserOfflineConflicts } from "../application/offlineConflictResolution";
import type { OfflineConflictMetadata } from "../domain/offlineConflict";
import { useOfflineConflicts } from "./useOfflineConflictCount";

export function OfflineConflictNotice({ userId, pets }: { userId: string | null; pets: { id: string; name: string }[] }) {
  const conflicts = useOfflineConflicts(userId);
  const [clearing, setClearing] = useState(false);
  const [clearFailed, setClearFailed] = useState(false);

  if (!userId || conflicts.length === 0) return null;
  const notice = t("sync.conflictsNeedAttention").replace("{count}", String(conflicts.length));

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
      <NoticeBanner text={notice} icon="shield" tone="info" />
      <View style={styles.details}>
        <Text style={styles.detailsTitle}>{t("sync.conflictDetailsTitle")}</Text>
        {conflicts.map((conflict) => <Text key={conflict.id} style={styles.detailLine}>• {conflictLabel(conflict, pets)}</Text>)}
      </View>
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
  details: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  detailsTitle: {
    ...type.caption,
    color: colors.text,
    fontWeight: "700",
  },
  detailLine: {
    ...type.caption,
    color: colors.textMuted,
  },
});

const categoryKeys: Record<string, TranslationKey> = {
  food: "category.food", water: "category.water", walk: "category.walk", stool: "category.stool",
  condition: "category.condition", memo: "category.memo", photo: "category.photo", medication: "category.medication",
};

function conflictLabel(conflict: OfflineConflictMetadata, pets: { id: string; name: string }[]) {
  const pet = pets.find((item) => item.id === conflict.petId)?.name
    ?? t("sync.petIdFallback").replace("{id}", conflict.petId?.slice(0, 8) ?? "—");
  const categoryKey = conflict.category ? categoryKeys[conflict.category] : undefined;
  const category = categoryKey ? t(categoryKey) : t("sync.unknownCategory");
  return t("sync.conflictItem").replace("{pet}", pet).replace("{category}", category).replace("{date}", conflict.recordDate);
}
