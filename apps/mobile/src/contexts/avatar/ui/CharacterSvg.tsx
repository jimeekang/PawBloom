import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { defaultAppearance, type Appearance, type CharacterSpecies } from '../domain/appearance';
import { getPixelFrame, type CharacterPose } from '../domain/pixelFrames';
import { CharacterMotionView } from './CharacterMotionView';
import { characterAppearanceKey, characterPixelPaths } from './pixelPaths';
import { characterHeadCrop } from './characterHeadCrop';
import { useCharacterMotion, type CharacterMotionOptions } from './useCharacterMotion';

/** size is the displayed width of the 48px logical grid, without an implicit multiplier. The head crop runs from the ears to the chin. */
export function defaultCharacterCanvas(size: number, withBody: boolean, species: CharacterSpecies = 'cat') { return { width:size,height:withBody?size:size*characterHeadCrop(species).rows/48 }; }
export function characterGroundOffset(size: number) { return size*45/48; }
export type CharacterSvgProps = {
  species: CharacterSpecies; appearance?: Appearance; size: number; withBody?: boolean;
  motion?: Partial<CharacterMotionOptions>; pose?: CharacterPose;
};
const speciesDefaults = new Map<CharacterSpecies, Appearance>();
/** One default object per species, so callers without an appearance (DefaultPetCharacter) don't churn memo deps. */
function defaultFor(species: CharacterSpecies) { let value = speciesDefaults.get(species); if (!value) { value = defaultAppearance(species); speciesDefaults.set(species, value); } return value; }
export function CharacterSvg({ species, appearance: given, size, withBody = false, motion, pose }: CharacterSvgProps) {
  const {values:v,pose:clipPose,frames,opacities} = useCharacterMotion({id:'character',enabled:false,paused:true,reduced:true,...motion},{species,pose:withBody?pose:'sit'});
  const appearance = given ?? defaultFor(species), appearanceKey = characterAppearanceKey(appearance);
  const paths = useMemo(() => (withBody?frames:[getPixelFrame(species,'sit')]).map(frame => characterPixelPaths(frame,appearance,species,withBody)),[species,appearanceKey,withBody,clipPose]);
  const canvas = defaultCharacterCanvas(size,withBody,species), crispEdges = {shapeRendering:'crispEdges'};
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={canvas}>
    <CharacterMotionView testID="character-root" sources={[v.opacity,v.wander,v.direction,v.lift]} style={[StyleSheet.absoluteFill,{opacity:v.opacity,transform:[{translateX:v.wander},{translateY:v.lift.interpolate({inputRange:[0,1],outputRange:[0,-10]})},{scaleX:v.direction}]}]}>
      {paths.map((frame,index) => <CharacterMotionView key={`${clipPose}:${index}`} testID={`character-frame-${index}`} sources={withBody?[v.frame]:[]} style={[StyleSheet.absoluteFill,{opacity:withBody?opacities[index]:1}]}>
        <Svg width={canvas.width} height={canvas.height} viewBox={withBody?'0 0 48 48':`0 0 48 ${characterHeadCrop(species).rows}`} preserveAspectRatio="xMidYMid meet" {...crispEdges}>
          {frame.map(part => <Path key={part.fill} d={part.d} fill={part.fill} {...crispEdges} />)}
        </Svg>
      </CharacterMotionView>)}
    </CharacterMotionView>
  </View>;
}
