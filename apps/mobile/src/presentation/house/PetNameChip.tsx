import { StyleSheet, Text, View } from "react-native";
import type { PetProfile } from "../../contexts/pet/domain/pet";
import { AppIcon, type AppIconName } from "../../design-system/iconography";
import { colors, font, iconSize, radius, spacing, type } from "../../design-system/tokens";

export type StatusTone = "pending" | "success" | "warning" | "neutral";

/** Names the exact pet on shared lists; the species glyph never pretends to be the pet's photo. */
export function PetNameChip({ pet }: { pet: Pick<PetProfile, "name" | "species"> }) {
  return (
    <View style={styles.petChip}>
      <AppIcon name={pet.species === "cat" ? "cat" : pet.species === "dog" ? "pet" : "logo"} size={iconSize.xs - 2} color={colors.textMuted} />
      <Text style={styles.petChipText} numberOfLines={1}>{pet.name}</Text>
    </View>
  );
}

const toneStyles: Record<StatusTone, { background: string; color: string; border: string }> = {
  pending: { background: colors.surfacePeach, color: colors.pendingText, border: colors.segmentActiveBorder },
  success: { background: colors.successBg, color: colors.successText, border: colors.successBg },
  warning: { background: colors.warningBg, color: colors.warningText, border: colors.warningBg },
  neutral: { background: colors.neutralBg, color: colors.textMuted, border: colors.neutralBg },
};

/** Status is carried by icon + text, never by color alone. */
export function StatusChip({ tone, icon, label }: { tone: StatusTone; icon: AppIconName; label: string }) {
  const tones = toneStyles[tone];
  return (
    <View style={[styles.statusChip, { backgroundColor: tones.background, borderColor: tones.border }]}>
      <AppIcon name={icon} size={iconSize.xs} color={tones.color} />
      <Text style={[styles.statusText, { color: tones.color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  petChip: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  petChipText: {
    ...type.tiny,
    flexShrink: 1,
    color: colors.textMuted,
    fontWeight: font.weight.semibold,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    minHeight: 26,
    borderRadius: radius.full,
    borderWidth: 1,
    maxWidth: 120,
  },
  statusText: {
    ...type.tiny,
    fontWeight: font.weight.semibold,
    flexShrink: 1,
  },
});
