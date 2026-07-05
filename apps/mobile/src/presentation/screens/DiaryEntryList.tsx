import { Pressable, StyleSheet, Text, View } from "react-native";
import type { DiaryEntry } from "../../contexts/diary/domain/diaryEntry";
import { categoryVisuals } from "../../design-system/categoryVisuals";
import { SurfaceCard } from "../../design-system/components";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";

export function DiaryEntryList({ entries, title, onEntryPress }: { entries: DiaryEntry[]; title: string; onEntryPress?: (entry: DiaryEntry) => void }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <SurfaceCard>
        <View style={styles.list}>
          {entries.length === 0 ? <Text style={styles.emptyText}>{t("ko", "diary.noEntries")}</Text> : null}
          {entries.map((entry) => {
            const visual = categoryVisuals[entry.category];
            const row = (
              <>
                <AppIcon name={visual.icon} size={iconSize.md} color={visual.color} />
                <View style={styles.body}>
                  <Text style={styles.title}>{visual.label}</Text>
                  <Text style={styles.summary} numberOfLines={2}>{entry.summary}</Text>
                </View>
                <View style={styles.meta}>
                  <Text style={styles.time}>{entry.occurredAt}</Text>
                  {entry.photoCount ? <Text style={styles.photoCount}>{t("ko", "diary.photoCount").replace("{count}", String(entry.photoCount))}</Text> : null}
                </View>
              </>
            );

            return onEntryPress ? (
              <Pressable key={entry.id} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={() => onEntryPress(entry)}>
                {row}
              </Pressable>
            ) : (
              <View key={entry.id} style={styles.row}>
                {row}
              </View>
            );
          })}
        </View>
      </SurfaceCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...type.sectionTitle,
  },
  list: {
    gap: spacing.md,
  },
  emptyText: {
    ...type.body,
    color: colors.textMuted,
  },
  row: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  rowPressed: {
    opacity: 0.72,
  },
  body: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    ...type.bodyStrong,
  },
  summary: {
    ...type.caption,
  },
  meta: {
    alignItems: "flex-end",
    minWidth: 56,
    gap: spacing.xxs,
  },
  time: {
    ...type.caption,
    color: colors.text,
  },
  photoCount: {
    ...type.tiny,
    color: colors.orangeDeep,
  },
});
