import { Image, StyleSheet, View } from "react-native";
import type { PetProfile } from "../../contexts/pet/domain/pet";
import { usePetProfilePhotoUrl } from "../../contexts/pet/application/profilePhotoUrl";
import { colors, sceneColors } from "../../design-system/tokens";
import { DefaultPetCharacter } from "./DefaultPetCharacter";

export type PetAvatarProps = {
  pet: Pick<PetProfile, "id" | "species">;
  /** Null (preview) never requests private photos and shows the species default. */
  userId: string | null;
  size?: number;
};

/** Profile photo when one exists, otherwise the species default face. Decorative: the caller shows the name. */
export function PetAvatar({ pet, userId, size = 40 }: PetAvatarProps) {
  const photoUrl = usePetPhoto(pet.id, userId);
  const frame = { width: size, height: size, borderRadius: size / 2 };
  if (photoUrl) {
    return <Image source={{ uri: photoUrl }} accessibilityIgnoresInvertColors style={[styles.photo, frame]} />;
  }
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.face, frame]}>
      <DefaultPetCharacter species={pet.species} size={size * 0.7} />
    </View>
  );
}

/** Shared photo lookup for avatar and house character (existing profile photo path). */
export function usePetPhoto(petId: string, userId: string | null): string | null {
  const photo = usePetProfilePhotoUrl(userId ? petId : null, userId);
  return typeof photo.data === "string" && photo.data ? photo.data : null;
}

const styles = StyleSheet.create({
  photo: {
    backgroundColor: colors.surfaceWarm,
    borderWidth: 2,
    borderColor: colors.white,
  },
  face: {
    backgroundColor: sceneColors.wall,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
});
