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
  // Wait for the real reduce-motion answer: mounting under the fail-closed default would spend the save event on opacity only.
  if (!visible || !motion.active || !motion.settled) return null;
  return <View pointerEvents="none" style={styles.reaction}><CharacterSvg species={subject.pet.species} appearance={appearance} size={REACTION_SIZE} withBody motion={{ id: subject.pet.id, enabled: false, reduced: motion.reduced, saved: eventId }} /></View>;
}
/** v2 scale: a small celebration, not a second hero character. */
const REACTION_SIZE = 62;
/** Mirrors shell/SaveFeedbackBar (headerOffset 76 + minHeight 86): the pet sits just under the toast's right
 * corner, clear of the screen title above and of save buttons in the scrolling content. */
const TOAST_BOTTOM = 76 + 86;
const styles = StyleSheet.create({ reaction: { position: "absolute", zIndex: 21, right: layout.screenPadding + spacing.md, top: TOAST_BOTTOM + spacing.xxs } });
