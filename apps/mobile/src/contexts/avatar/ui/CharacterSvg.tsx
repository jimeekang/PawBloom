import { CharacterMotionView } from "./CharacterMotionView";
import { useId, useMemo } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import Svg, { ClipPath, Defs, Path } from "react-native-svg";
import { sceneColors } from "../../../design-system/tokens";
import { defaultAppearance, type Appearance, type CharacterSpecies } from "../domain/appearance";
import { characterEyeY, characterLayers, type CharacterLayer } from "../domain/catCharacterGeometry";
import { characterSvgClips } from "../domain/characterSvgClips";
import { characterGeometry } from "../domain/dogCharacterGeometry";
import { characterPalette } from "./characterPalette";
import { useCharacterMotion, type CharacterMotionOptions } from "./useCharacterMotion";

export function defaultCharacterCanvas(size: number, withBody: boolean) { return { width: size * 1.2, height: size * (withBody ? 1.6 : 1.12) }; }
export type CharacterSvgProps = {
  species: CharacterSpecies; appearance?: Appearance; size: number; withBody?: boolean;
  motion?: Partial<CharacterMotionOptions>; pose?: "idle" | "blink" | "sit" | "lift" | "saveReact";
};

/** Six independently transformed SVG layers, shared with the static sheet renderer. */
export function CharacterSvg({ species, appearance = defaultAppearance(species), size, withBody = false, motion, pose }: CharacterSvgProps) {
  const renderId = useId();
  const { values: v, smiling, blushing } = useCharacterMotion({ id: "character", enabled: false, paused: true, reduced: true, ...motion });
  const geometry = useMemo(() => characterGeometry(species, appearance, smiling || pose === "saveReact"), [species, appearance, smiling, pose]);
  const palette = characterPalette(appearance);
  const canvas = defaultCharacterCanvas(size, withBody), unit = size / 100, eyeY = characterEyeY(species !== "cat");
  const lerp = (value: Animated.Value, from: number, to: number) => value.interpolate({ inputRange: [0, 1], outputRange: [from, to] });
  const bodyScale = Animated.multiply(lerp(v.breathe, 1, 1.02), lerp(v.sit, 1, 0.92));
  const sources = { tail: [v.tail], body: [v.breathe, v.sit], head: [v.breathe], backEar: [v.breathe, v.ear], eyes: [v.breathe, v.blink], frontPaws: [v.sit] };
  function layerStyle(layer: CharacterLayer) {
    if (layer === "tail") return { transform: [{ translateX: 26 * unit }, { translateY: 54 * unit }, { rotate: v.tail.interpolate({ inputRange: [-1, 1], outputRange: ["-6deg", "6deg"] }) }, { translateX: -26 * unit }, { translateY: -54 * unit }] };
    if (layer === "body") return { transform: [{ translateY: pose === "sit" ? canvas.height * 0.04 : lerp(v.sit, 0, canvas.height * 0.04) }, { scaleY: pose === "sit" ? 0.92 : bodyScale }] };
    if (layer === "eyes") return { transform: [{ translateY: Animated.multiply(v.breathe, -1) }, { translateY: (eyeY - (withBody ? 80 : 56)) * unit }, { scaleY: pose === "blink" ? 0.1 : v.blink }, { translateY: -(eyeY - (withBody ? 80 : 56)) * unit }] };
    if (layer === "backEar") return { transform: [{ translateY: Animated.multiply(v.breathe, -1) }, { translateX: -31 * unit }, { translateY: (32 - (withBody ? 80 : 56)) * unit }, { rotate: v.ear.interpolate({ inputRange: [-1, 1], outputRange: ["-8deg", "8deg"] }) }, { translateX: 31 * unit }, { translateY: -(32 - (withBody ? 80 : 56)) * unit }] };
    if (layer === "head") return { transform: [{ translateY: Animated.multiply(v.breathe, -1) }] };
    return { transform: [{ scaleX: pose === "sit" ? 0.9 : lerp(v.sit, 1, 0.9) }] };
  }
  const outer = { opacity: v.opacity, transform: [
    { translateX: v.wander }, { translateY: Animated.add(Animated.add(v.jump, lerp(v.lift, 0, -10)), lerp(v.bounce, 0, 2)) },
    { scale: Animated.multiply(lerp(v.lift, 1, 1.08), v.reveal) }, { scaleX: v.direction }, { scaleY: v.tap },
  ] };
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={canvas}>
      {withBody ? <CharacterMotionView sources={[v.lift, v.reveal, v.opacity]} style={[styles.shadow, { width: size * 0.92, height: size * 0.16, left: size * 0.14, bottom: -size * 0.025, opacity: Animated.multiply(lerp(v.lift, 1, 0.6), v.opacity), transform: [{ scale: Animated.multiply(lerp(v.lift, 1, 0.8), v.reveal) }] }]} /> : null}
      <CharacterMotionView testID="character-root" sources={[v.opacity, v.wander, v.jump, v.lift, v.bounce, v.reveal, v.direction, v.tap]} style={[StyleSheet.absoluteFill, outer, pose === "lift" && { transform: [{ translateY: -10 }, { scale: 1.08 }] }]}>
        {characterLayers.filter((layer) => withBody || ["backEar", "head", "eyes"].includes(layer)).map((layer) => {
          // useId also separates the same pet rendered in a room, chip, and builder at once.
          const clipped = characterSvgClips(geometry[layer], JSON.stringify([motion?.id ?? species, renderId]), layer);
          return (
          <CharacterMotionView key={layer} testID={`character-${layer}`} sources={sources[layer]} style={[StyleSheet.absoluteFill, layerStyle(layer) as Animated.WithAnimatedObject<ViewStyle>]}>
            <Svg width={canvas.width} height={canvas.height} viewBox={`0 0 120 ${withBody ? 160 : 112}`}>
              <Defs>{clipped.definitions.map((clip) => <ClipPath key={clip.id} id={clip.id}><Path d={clip.d} /></ClipPath>)}</Defs>
              {clipped.paths.map((part, index) => <Path key={index} d={part.d} clipPath={part.clipId ? `url(#${part.clipId})` : undefined} fill={part.fill === "none" ? "none" : palette[part.fill]} stroke={part.stroke ? palette[part.stroke] : undefined} strokeWidth={part.strokeWidth} vectorEffect={part.nonScalingStroke ? "non-scaling-stroke" : undefined} opacity={part.fill === "blush" && blushing ? 0.9 : part.opacity} strokeLinecap="round" strokeLinejoin="round" />)}
            </Svg>
          </CharacterMotionView>
          );
        })}
      </CharacterMotionView>
    </View>
  );
}
const styles = StyleSheet.create({ shadow: { position: "absolute", borderRadius: 999, backgroundColor: sceneColors.groundShadow } });
