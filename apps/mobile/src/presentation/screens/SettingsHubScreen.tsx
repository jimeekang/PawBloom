import { StyleSheet, View } from "react-native";
import { SettingsScreen } from "../../contexts/identity/ui/SettingsScreen";
import type { PetProfile } from "../../contexts/pet/domain/pet";
import { PetMembersCard } from "../../contexts/pet/ui/PetMembersCard";
import { SecondaryButton } from "../../design-system/components";
import { t } from "../../i18n/translations";
import { spacing } from "../../design-system/tokens";

export function SettingsHubScreen({
  email,
  configured,
  userId,
  pets,
  onOpenPetProfiles,
  onOpenPetProfile,
  onSignOut,
}: {
  email?: string;
  configured: boolean;
  userId: string | null;
  pets: readonly PetProfile[];
  onOpenPetProfiles: () => void;
  onOpenPetProfile: (petId: string) => void;
  onSignOut: () => void;
}) {
  return (
    <View style={styles.screen}>
      <SettingsScreen email={email} configured={configured} onOpenPetProfiles={onOpenPetProfiles} onSignOut={onSignOut} />
      {pets.map((pet) => <View key={pet.id}><SecondaryButton label={`${t("pet.manageTitle")}: ${pet.name}`} onPress={() => onOpenPetProfile(pet.id)} /><PetMembersCard pet={pet} configured={configured} userId={userId} /></View>)}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.lg },
});
