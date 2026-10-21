import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import type { Species } from "../../contexts/pet/domain/pet";
import { sceneColors } from "../../design-system/tokens";

const palettes: Record<Species, { fur: string; ear: string }> = {
  dog: { fur: sceneColors.dogFur, ear: sceneColors.dogEar },
  cat: { fur: sceneColors.catFur, ear: sceneColors.catEar },
  other: { fur: sceneColors.otherFur, ear: sceneColors.otherEar },
};

export type DefaultPetCharacterProps = {
  species: Species;
  /** Head diameter in px; every part scales from it. */
  size: number;
  /** Optional eye scaleY driver (1 open, ~0.1 closed). */
  blink?: Animated.Value;
  /** Adds a sitting body, paws and tail under the head (house scene). */
  withBody?: boolean;
};

/** Canvas size for a default character so photo and shape characters share one slot. */
export function defaultCharacterCanvas(size: number, withBody: boolean) {
  return { width: size * 1.2, height: withBody ? size * 1.6 : size * 1.12 };
}

/**
 * Plain-shape stand-in used before (or without) a generated character: no
 * emoji, no asset. It is decorative, so the caller owns the accessible name,
 * and its face never reflects health or mood.
 */
export function DefaultPetCharacter({ species, size: s, blink, withBody = false }: DefaultPetCharacterProps) {
  const palette = palettes[species];
  const canvas = defaultCharacterCanvas(s, withBody);
  const head = { x: s * 0.1, y: s * 0.1 };
  const at = (cx: number, cy: number, width: number, height: number): ViewStyle => ({ position: "absolute", left: head.x + cx * s - (width * s) / 2, top: head.y + cy * s - (height * s) / 2, width: width * s, height: height * s, borderRadius: (Math.max(width, height) * s) / 2 });
  const eyeWidth = species === "cat" ? 0.13 : 0.12;
  const eyeHeight = species === "cat" ? 0.15 : 0.12;
  const eyeStyle = blink ? { transform: [{ scaleY: blink }] } : null;
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={canvas}>
      {withBody ? <>
        <View style={[at(0.9, 1.0, 0.16, 0.4), { backgroundColor: palette.fur, transform: [{ rotate: species === "cat" ? "28deg" : "38deg" }] }]} />
        <View style={[at(0.5, 1.12, 0.84, 0.6), { backgroundColor: palette.fur }]} />
        <View style={[at(0.34, 1.38, 0.24, 0.14), { backgroundColor: sceneColors.muzzle }]} />
        <View style={[at(0.66, 1.38, 0.24, 0.14), { backgroundColor: sceneColors.muzzle }]} />
      </> : null}
      {species === "cat" ? <>
        <View style={[styles.triangle, triangle(head.x + s * 0.06, head.y - s * 0.08, s, sceneColors.catEar), { transform: [{ rotate: "-14deg" }] }]} />
        <View style={[styles.triangle, triangle(head.x + s * 0.6, head.y - s * 0.08, s, sceneColors.catEar), { transform: [{ rotate: "14deg" }] }]} />
      </> : null}
      {species === "other" ? <>
        <View style={[at(0.2, 0.08, 0.3, 0.3), { backgroundColor: palette.ear }]} />
        <View style={[at(0.8, 0.08, 0.3, 0.3), { backgroundColor: palette.ear }]} />
      </> : null}
      <View style={[at(0.5, 0.5, 1, 1), { backgroundColor: palette.fur }]} />
      {species === "dog" ? <>
        <View style={[at(0.08, 0.42, 0.3, 0.54), { backgroundColor: palette.ear, borderRadius: s * 0.15, transform: [{ rotate: "16deg" }] }]} />
        <View style={[at(0.92, 0.42, 0.3, 0.54), { backgroundColor: palette.ear, borderRadius: s * 0.15, transform: [{ rotate: "-16deg" }] }]} />
      </> : null}
      {species !== "cat" ? <View style={[at(0.5, 0.68, 0.46, 0.32), { backgroundColor: sceneColors.muzzle }]} /> : null}
      <Animated.View style={[at(0.33, 0.46, eyeWidth, eyeHeight), { backgroundColor: sceneColors.face }, eyeStyle]} />
      <Animated.View style={[at(0.67, 0.46, eyeWidth, eyeHeight), { backgroundColor: sceneColors.face }, eyeStyle]} />
      <View style={[at(0.5, 0.6, species === "cat" ? 0.1 : 0.15, species === "cat" ? 0.07 : 0.1), { backgroundColor: species === "cat" ? sceneColors.blush : sceneColors.face }]} />
      <View style={[at(0.2, 0.64, 0.13, 0.07), styles.blush]} />
      <View style={[at(0.8, 0.64, 0.13, 0.07), styles.blush]} />
      {species === "cat" ? <>
        <View style={[at(0.1, 0.66, 0.2, 0.02), styles.whisker, { transform: [{ rotate: "8deg" }] }]} />
        <View style={[at(0.9, 0.66, 0.2, 0.02), styles.whisker, { transform: [{ rotate: "-8deg" }] }]} />
      </> : null}
    </View>
  );
}

function triangle(left: number, top: number, s: number, color: string): ViewStyle {
  return { left, top, borderLeftWidth: s * 0.17, borderRightWidth: s * 0.17, borderBottomWidth: s * 0.34, borderBottomColor: color };
}

const styles = StyleSheet.create({
  triangle: {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    backgroundColor: "transparent",
  },
  blush: {
    backgroundColor: sceneColors.blush,
    opacity: 0.55,
  },
  whisker: {
    backgroundColor: sceneColors.face,
    opacity: 0.35,
    borderRadius: 1,
  },
});
