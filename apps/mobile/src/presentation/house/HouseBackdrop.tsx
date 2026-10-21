import { StyleSheet, View } from "react-native";
import { radius, sceneColors } from "../../design-system/tokens";

export type HouseBackdropProps = {
  /** Full (possibly widened) room width. */
  width: number;
  /** Visible width; one window and rug repeat per visible page. */
  viewport: number;
  height: number;
  floorTop: number;
};

/** One warm room: wall, baseboard, wooden floor. Static scenery, not a decoration feature. */
export function HouseBackdrop({ width, viewport, height, floorTop }: HouseBackdropProps) {
  const pages = Math.max(1, Math.ceil(width / Math.max(1, viewport)));
  const pageWidth = width / pages;
  const windowWidth = Math.min(116, pageWidth * 0.3);
  const windowHeight = Math.min(84, floorTop * 0.58);
  const floorHeight = height - floorTop;
  const planks = Math.max(1, Math.floor(floorHeight / 34));
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { width, height }]}>
      <View style={[styles.wall, { height: floorTop }]} />
      <View style={[styles.wallShade, { width }]} />
      {Array.from({ length: pages }, (_, page) => (
        <View key={`window-${page}`} style={[styles.window, { left: page * pageWidth + pageWidth * 0.58, top: floorTop * 0.2, width: windowWidth, height: windowHeight }]}>
          <View style={styles.windowBarVertical} />
          <View style={styles.windowBarHorizontal} />
        </View>
      ))}
      <View style={[styles.floor, { top: floorTop, height: floorHeight }]} />
      {Array.from({ length: planks }, (_, index) => (
        <View key={`plank-${index}`} style={[styles.plank, { top: floorTop + 10 + (index + 1) * (floorHeight / (planks + 1)) }]} />
      ))}
      {Array.from({ length: pages }, (_, page) => (
        <View key={`rug-${page}`} style={[styles.rug, { left: page * pageWidth + pageWidth * 0.14, top: floorTop + floorHeight * 0.42, width: pageWidth * 0.72, height: floorHeight * 0.36, borderRadius: pageWidth }]} />
      ))}
      <View style={[styles.baseboard, { top: floorTop - 4 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wall: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: sceneColors.wall,
  },
  wallShade: {
    position: "absolute",
    left: 0,
    top: 0,
    height: 14,
    backgroundColor: sceneColors.wallShade,
  },
  window: {
    position: "absolute",
    borderRadius: radius.sm,
    borderWidth: 4,
    borderColor: sceneColors.windowFrame,
    backgroundColor: sceneColors.window,
    overflow: "hidden",
  },
  windowBarVertical: {
    position: "absolute",
    left: "50%",
    top: 0,
    bottom: 0,
    width: 3,
    marginLeft: -1.5,
    backgroundColor: sceneColors.windowFrame,
  },
  windowBarHorizontal: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    height: 3,
    marginTop: -1.5,
    backgroundColor: sceneColors.windowFrame,
  },
  floor: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: sceneColors.floor,
  },
  plank: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: sceneColors.floorLine,
  },
  rug: {
    position: "absolute",
    backgroundColor: sceneColors.rug,
    opacity: 0.85,
  },
  baseboard: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: sceneColors.baseboard,
  },
});
