import { useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { DiaryEntry } from "../domain/diaryEntry";
import { categoryVisuals } from "../../../design-system/categoryVisuals";
import { SurfaceCard } from "../../../design-system/components";
import { AppIcon } from "../../../design-system/iconography";
import { colors, iconSize, spacing, type } from "../../../design-system/tokens";
import { t } from "../../../i18n/translations";

export function DiaryEntryList({ entries, title, onEntryPress }: { entries: DiaryEntry[]; title: string; onEntryPress?: (entry: DiaryEntry) => void }) {
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);

  return (
    <>
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
                    <Text style={styles.title}>{t("ko", visual.labelKey)}</Text>
                    <Text style={styles.summary} numberOfLines={2}>{entry.category === "photo" ? t("ko", "category.photo") : entry.summary}</Text>
                  </View>
                  <View style={styles.meta}>
                    <Text style={styles.time}>{entry.occurredAt}</Text>
                    {entry.photoCount ? <Text style={styles.photoCount}>{t("ko", "diary.photoCount").replace("{count}", String(entry.photoCount))}</Text> : null}
                  </View>
                </>
              );

              return (
                <View key={entry.id} style={styles.entry}>
                  {onEntryPress ? (
                    <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={() => onEntryPress(entry)}>
                      {row}
                    </Pressable>
                  ) : (
                    <View style={styles.row}>{row}</View>
                  )}
                  {entry.photoUrls?.length ? (
                    <View style={styles.photoRow}>
                      {entry.photoUrls.map((photoUrl, index) => (
                        <Pressable
                          key={photoUrl}
                          accessibilityRole="imagebutton"
                          accessibilityLabel={`${t("ko", "diary.photos")} ${index + 1}`}
                          onPress={() => setSelectedPhotoUrl(photoUrl)}
                        >
                          <Image source={{ uri: photoUrl }} style={styles.photoThumbnail} />
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </SurfaceCard>
      </View>
      <Modal visible={Boolean(selectedPhotoUrl)} transparent animationType="fade" onRequestClose={() => setSelectedPhotoUrl(null)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("ko", "diary.photos")}
          style={styles.photoViewer}
          onPress={() => setSelectedPhotoUrl(null)}
        >
          {selectedPhotoUrl ? <Image source={{ uri: selectedPhotoUrl }} style={styles.fullPhoto} resizeMode="contain" /> : null}
          <View style={styles.closeButton}>
            <AppIcon name="close" size={iconSize.md} color={colors.white} />
          </View>
        </Pressable>
      </Modal>
    </>
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
  entry: {
    gap: spacing.sm,
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
  photoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingLeft: iconSize.md + spacing.md,
  },
  photoThumbnail: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  photoViewer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  fullPhoto: {
    width: "100%",
    height: "100%",
  },
  closeButton: {
    position: "absolute",
    top: 56,
    right: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
});
