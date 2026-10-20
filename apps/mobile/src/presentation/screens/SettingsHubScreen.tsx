import { StyleSheet, View } from "react-native";
import { SettingsScreen } from "../../contexts/identity/ui/SettingsScreen";
import type { PetProfile } from "../../contexts/pet/domain/pet";
import { PetMembersCard } from "../../contexts/pet/ui/PetMembersCard";
import { spacing } from "../../design-system/tokens";

export function SettingsHubScreen({
  email,
  configured,
  userId,
  activePet,
  onOpenPetProfiles,
  onSignOut,
}: {
  email?: string;
  configured: boolean;
  userId: string | null;
  activePet: PetProfile;
  onOpenPetProfiles: () => void;
  onSignOut: () => void;
}) {
  return (
    <View style={styles.screen}>
      <SettingsScreen email={email} configured={configured} onOpenPetProfiles={onOpenPetProfiles} onSignOut={onSignOut} />
      <PetMembersCard
        pet={activePet}
        configured={configured}
        userId={userId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.lg },
});
