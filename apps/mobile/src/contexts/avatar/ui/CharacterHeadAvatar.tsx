import { StyleSheet, View } from "react-native";
import { colors, sceneColors } from "../../../design-system/tokens";
import type { Appearance, CharacterSpecies } from "../domain/appearance";
import { CharacterSvg } from "./CharacterSvg";
import { characterHeadCrop } from "./characterHeadCrop";

const BORDER = 1;
/** Clear ring between the farthest pixel corner (ear tip, whisker, chin) and the circle's inner edge. */
export function characterHeadPadding(size: number) { return Math.max(1, size * 0.04); }
/** Logical-pixel scale and offset that centre the head crop's enclosing circle inside a size×size frame. */
export function characterHeadLayout(species: CharacterSpecies, size: number) {
  const crop = characterHeadCrop(species), inner = size / 2 - BORDER - characterHeadPadding(size);
  const scale = inner / crop.radius, center = size / 2 - BORDER;
  return { width: 48 * scale, left: center - crop.centerX * scale, top: center - crop.centerY * scale, scale };
}
/** One framing for every head avatar (nearby care, pet chips, builder presets): wall-coloured circle, centred head. */
export function CharacterHeadAvatar({ species, appearance, size }: { species: CharacterSpecies; appearance?: Appearance; size: number }) {
  const head = characterHeadLayout(species, size);
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.face, { width: size, height: size, borderRadius: size / 2 }]}>
    <View style={{ position: "absolute", left: head.left, top: head.top }}>
      <CharacterSvg species={species} appearance={appearance} size={head.width} />
    </View>
  </View>;
}
const styles = StyleSheet.create({
  face: { backgroundColor: sceneColors.wall, overflow: "hidden", borderWidth: BORDER, borderColor: colors.border },
});
