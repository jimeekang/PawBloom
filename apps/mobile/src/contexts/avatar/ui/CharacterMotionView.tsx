import { Animated } from "react-native";
import type { ComponentProps } from "react";

export type CharacterMotionViewProps = ComponentProps<typeof Animated.View> & { sources?: readonly Animated.Value[] };
export function CharacterMotionView({ sources: _sources, ...props }: CharacterMotionViewProps) { return <Animated.View {...props} />; }
