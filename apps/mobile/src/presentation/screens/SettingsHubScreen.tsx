import { StyleSheet, View } from "react-native";
import { SettingsScreen } from "../../contexts/identity/ui/SettingsScreen";
import type { PetProfile } from "../../contexts/pet/domain/pet";
import { PetMembersCard } from "../../contexts/pet/ui/PetMembersCard";
import { useSubscriptionEntitlement } from "../../contexts/subscription/application/subscriptionEntitlement";
import { entitlements } from "../../contexts/subscription/domain/entitlement";
import { SubscriptionPlanCard } from "../../contexts/subscription/ui/SubscriptionPlanCard";
import { spacing } from "../../design-system/tokens";

export function SettingsHubScreen({
  email,
  configured,
  userId,
  activePet,
  ownedPetCount,
  onOpenPetProfiles,
  onSignOut,
}: {
  email?: string;
  configured: boolean;
  userId: string | null;
  activePet: PetProfile;
  ownedPetCount: number;
  onOpenPetProfiles: () => void;
  onSignOut: () => void;
}) {
  const entitlementQuery = useSubscriptionEntitlement(userId, configured);
  const entitlement = configured ? entitlementQuery.data ?? null : entitlements.plus;
  const entitlementLoading = Boolean(configured && userId && entitlementQuery.isLoading);
  const entitlementFailed = Boolean(configured && userId && entitlementQuery.isError);

  return (
    <View style={styles.screen}>
      <SettingsScreen email={email} configured={configured} onOpenPetProfiles={onOpenPetProfiles} onSignOut={onSignOut} />
      <PetMembersCard
        pet={activePet}
        configured={configured}
        userId={userId}
        entitlement={entitlement}
        entitlementLoading={entitlementLoading}
        entitlementFailed={entitlementFailed}
      />
      <SubscriptionPlanCard
        entitlement={entitlement}
        ownedPetCount={ownedPetCount}
        loading={entitlementLoading}
        failed={entitlementFailed}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.lg },
});
