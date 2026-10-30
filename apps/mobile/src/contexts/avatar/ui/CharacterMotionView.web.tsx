import { useLayoutEffect, useRef, type ComponentProps } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { bindWebMotion, resolveMotionStyle } from "./webMotionBinding";

export function CharacterMotionView({ style, sources, ...props }: ComponentProps<typeof Animated.View> & { sources?: readonly Animated.Value[] }) {
  const target = useRef<View>(null);
  const flattened = StyleSheet.flatten(style) ?? {};
  useLayoutEffect(() => {
    const node = target.current as unknown as HTMLElement | null;
    if (node) return bindWebMotion(node, flattened as Parameters<typeof bindWebMotion>[1], sources as unknown as Parameters<typeof bindWebMotion>[2]);
  }, [style, sources]);
  return <View {...props as ComponentProps<typeof View>} ref={target} style={resolveMotionStyle(flattened)} />;
}
