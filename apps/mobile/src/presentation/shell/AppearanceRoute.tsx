import { Modal, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePetAppearance } from "../../contexts/avatar/application/usePetAppearance";
import { AppearanceBuilder } from "../../contexts/avatar/ui/AppearanceBuilder";
import { AvatarPhotoGeneration } from "../../contexts/avatar/ui/AvatarPhotoGeneration";
import type { PetProfile } from "../../contexts/pet/domain/pet";
import { NoticeBanner, SecondaryButton } from "../../design-system/components";
import { colors, spacing } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import { useHouseMotionState } from "../house/useHouseMotionEnabled";

export { CharacterSaveReaction } from "../house/CharacterSaveReaction";
export { useAppearanceOnboarding } from "./appearanceOnboarding";

export function AppearanceRoute(props: { pet?: PetProfile; userId: string | null; onboarding: boolean; onClose: () => void }) {
  return props.pet ? <AccessibleAppearanceRoute {...props} pet={props.pet} /> : null;
}
function AccessibleAppearanceRoute({ pet, userId, onboarding, onClose }: { pet: PetProfile; userId: string | null; onboarding: boolean; onClose: () => void }) {
  const state = usePetAppearance(userId, pet.id, pet.species);
  const motion = useHouseMotionState(true, false);
  return <Modal visible animationType="none" onRequestClose={onClose}>
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.appBackground }}>
      {state.loading || state.failed ? <View style={{ padding: spacing.xl, gap: spacing.md }}>
        <NoticeBanner text={t(state.failed ? "character.loadFailed" : "app.loading")} tone={state.failed ? "error" : "progress"} icon={state.failed ? "close" : "time"} />
        {state.failed ? <SecondaryButton label={t("diary.listRetry")} onPress={() => void state.retry()} /> : null}
        <SecondaryButton label={t("navigation.back")} onPress={onClose} />
      </View> : <AppearanceBuilder key={`${userId}:${pet.id}:${pet.species}`} pet={pet} initialAppearance={state.appearance} onSave={state.save} onClose={onClose} onboarding={onboarding} motionEnabled={motion.enabled} reducedMotion={motion.reduced}
        photoGeneration={({ load, disabled }) => <AvatarPhotoGeneration userId={userId} pet={pet} disabled={disabled} motionEnabled={motion.enabled} reducedMotion={motion.reduced} onLoad={load} />} />}
    </SafeAreaView>
  </Modal>;
}
