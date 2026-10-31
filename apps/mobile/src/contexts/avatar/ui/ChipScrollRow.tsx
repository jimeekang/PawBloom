import { useRef, useState, type ReactNode } from "react";
import { Platform, ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { colors, spacing } from "../../../design-system/tokens";

const FADE_WIDTH = 28;
let rowSequence = 0;
/** Keyboard focus on web does not scroll an RN Web ScrollView; center the focused chip so it clears the edge fade. */
export const revealChipOnFocus = Platform.OS === "web"
  ? (event: { currentTarget: unknown }) => (event.currentTarget as { scrollIntoView?: (options: object) => void }).scrollIntoView?.({ block: "nearest", inline: "center" })
  : undefined;
/**
 * Horizontal chip row that bleeds to the screen edge (the parent pads by `bleed`) and fades the side that still
 * has chips, so a cut-off chip reads as "scroll for more" instead of a clipping bug.
 */
export function ChipScrollRow({ children, bleed = spacing.lg, background = colors.appBackground }: { children: ReactNode; bleed?: number; background?: string }) {
  const size = useRef({ view: 0, content: 0, x: 0 });
  // SVG gradient ids are document-global on web: each row instance needs its own.
  const gradientId = useRef(`chip-fade-${++rowSequence}`).current;
  const [edges, setEdges] = useState({ start: false, end: false });
  function sync() {
    const { view, content, x } = size.current, start = x > 1, end = content - view - x > 1;
    setEdges((current) => current.start === start && current.end === end ? current : { start, end });
  }
  return <View style={{ marginHorizontal: -bleed }}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEventThrottle={32}
      contentContainerStyle={[styles.content, { paddingHorizontal: bleed }]}
      onLayout={(event: LayoutChangeEvent) => { size.current.view = event.nativeEvent.layout.width; sync(); }}
      onContentSizeChange={(width: number) => { size.current.content = width; sync(); }}
      onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => { size.current.x = event.nativeEvent.contentOffset.x; sync(); }}>
      {children}
    </ScrollView>
    {edges.start ? <Fade side="start" color={background} id={`${gradientId}-start`} /> : null}
    {edges.end ? <Fade side="end" color={background} id={`${gradientId}-end`} /> : null}
  </View>;
}
function Fade({ side, color, id }: { side: "start" | "end"; color: string; id: string }) {
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={`chip-fade-${side}`} style={[styles.fade, side === "start" ? { left: 0 } : { right: 0 }]}>
    <Svg width={FADE_WIDTH} height="100%">
      <Defs><LinearGradient id={id} x1={side === "start" ? 1 : 0} y1={0} x2={side === "start" ? 0 : 1} y2={0}>
        <Stop offset={0} stopColor={color} stopOpacity={0} /><Stop offset={1} stopColor={color} stopOpacity={1} />
      </LinearGradient></Defs>
      <Rect x={0} y={0} width={FADE_WIDTH} height="100%" fill={`url(#${id})`} />
    </Svg>
  </View>;
}
const styles = StyleSheet.create({
  content: { gap: spacing.xs, paddingVertical: spacing.xxs },
  fade: { position: "absolute", top: 0, bottom: 0, width: FADE_WIDTH },
});
