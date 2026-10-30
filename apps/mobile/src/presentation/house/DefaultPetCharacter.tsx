import type { Animated } from "react-native";
import type { Species } from "../../contexts/pet/domain/pet";
import { CharacterSvg } from "../../contexts/avatar/ui/CharacterSvg";
export { defaultCharacterCanvas } from "../../contexts/avatar/ui/CharacterSvg";

/** Default appearance is always a complete vector, including the empty house. */
export function DefaultPetCharacter({ species, size, withBody = false }: { species: Species; size: number; withBody?: boolean; blink?: Animated.Value }) {
  return <CharacterSvg species={species} size={size} withBody={withBody} />;
}
