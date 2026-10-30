import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { usePetAppearance } from "../../contexts/avatar/application/usePetAppearance";
import { CharacterSvg } from "../../contexts/avatar/ui/CharacterSvg";
import type { PetProfile } from "../../contexts/pet/domain/pet";
import { layout, spacing } from "../../design-system/tokens";
import { useHouseMotionState } from "./useHouseMotionEnabled";

/** The existing successful-record callback is the only trigger, never missed care. */
export function CharacterSaveReaction({ pet, userId, eventId }: { pet: PetProfile; userId: string | null; eventId: number }) {
  const subject = useRef({ pet, userId }).current;
  const { appearance } = usePetAppearance(subject.userId, subject.pet.id, subject.pet.species);
  const motion = useHouseMotionState(true, true);
  const [visible, setVisible] = useState(true);
  useEffect(() => { const timer = setTimeout(() => setVisible(false), 1200); return () => clearTimeout(timer); }, []);
  if (!visible || !motion.active) return null;
  return <View pointerEvents="none" style={styles.reaction}><CharacterSvg species={subject.pet.species} appearance={appearance} size={62} withBody motion={{ id: subject.pet.id, enabled: false, reduced: motion.reduced, saved: eventId }} /></View>;
}
const styles = StyleSheet.create({ reaction: { position: "absolute", right: spacing.xl, bottom: layout.bottomNavHeight + 90 } });
