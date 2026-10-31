import { Image, StyleSheet } from "react-native";
import type { PetProfile } from "../../contexts/pet/domain/pet";
import { usePetProfilePhotoUrl } from "../../contexts/pet/application/profilePhotoUrl";
import { colors } from "../../design-system/tokens";
import { CharacterHeadAvatar } from "../../contexts/avatar/ui/CharacterHeadAvatar";
import { usePetAppearance } from "../../contexts/avatar/application/usePetAppearance";

export type PetAvatarProps = {
  pet: Pick<PetProfile, "id" | "species">;
  /** Null (preview) never requests private photos and shows the species default. */
  userId: string | null;
  size?: number;
  characterOnly?: boolean;
};

/** Profile photo when one exists, otherwise the species default face. Decorative: the caller shows the name. */
export function PetAvatar({ pet, userId, size = 48, characterOnly = false }: PetAvatarProps) {
  const photoUrl = usePetPhoto(pet.id, userId);
  const { appearance } = usePetAppearance(userId, pet.id, pet.species);
  const frame = { width: size, height: size, borderRadius: size / 2 };
  if (photoUrl && !characterOnly) {
    return <Image source={{ uri: photoUrl }} accessibilityIgnoresInvertColors style={[styles.photo, frame]} />;
  }
  return <CharacterHeadAvatar species={pet.species} appearance={appearance} size={size} />;
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
});
