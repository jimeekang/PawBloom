import { StyleSheet, Text, View, type Animated } from "react-native";
import type { PetProfile } from "../../contexts/pet/domain/pet";
import { usePetAppearance } from "../../contexts/avatar/application/usePetAppearance";
import { CharacterSvg } from "../../contexts/avatar/ui/CharacterSvg";
import { AppIcon } from "../../design-system/iconography";
import { colors, font, iconSize, radius, sceneColors, spacing, type } from "../../design-system/tokens";

export type HouseCharacterProps = {
  pet: Pick<PetProfile, "id" | "name" | "species">; userId: string | null; size: number;
  motionEnabled: boolean; reducedMotion?: boolean; wanderPaused: boolean;
  lifted: boolean; tap?: number; wanderOffset?: Animated.Value;
};
/** Photos remain secondary information; every pet in the room is a character. */
export function HouseCharacter({ pet, userId, size, motionEnabled, reducedMotion = true, wanderPaused, lifted, tap, wanderOffset }: HouseCharacterProps) {
  const { appearance } = usePetAppearance(userId, pet.id, pet.species);
  return <View pointerEvents="none" style={styles.wrap}>
    <CharacterSvg species={pet.species} appearance={appearance} size={size} withBody motion={{ id: pet.id, enabled: motionEnabled, reduced: reducedMotion, paused: wanderPaused, lifted, tap, wanderOffset }} />
  </View>;
}
/** Scene owns the overlay so a nearer character cannot paint over another pet's name. */
export function HouseCharacterName({ pet, selected }: { pet: Pick<PetProfile, "name">; selected: boolean }) {
  return <View style={[styles.nameTag, selected && styles.nameTagSelected]}>
    {selected ? <AppIcon name="check" size={iconSize.xs} color={colors.orangeDeep} /> : null}
    <Text style={styles.nameText} numberOfLines={1}>{pet.name}</Text>
  </View>;
}
const styles = StyleSheet.create({
  wrap: { width: "100%", alignItems: "center" },
  nameTag: { marginTop: spacing.xxs, maxWidth: "100%", minHeight: 24, paddingHorizontal: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: sceneColors.nameTag, flexDirection: "row", alignItems: "center", gap: spacing.xxs },
  nameTagSelected: { borderWidth: 2, borderColor: colors.orange },
  nameText: { ...type.caption, flexShrink: 1, color: colors.text, fontWeight: font.weight.semibold },
});
