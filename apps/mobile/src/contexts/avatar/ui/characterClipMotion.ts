import { Animated } from 'react-native';
import type { PixelPose } from '../domain/pixelFrames';

export const characterClipFps: Partial<Record<PixelPose, number>> = { blink: 10, wave: 6, stretch: 6, sleep: 2, walkRight: 8, walkSide: 8, walkFront: 8, walkBack: 8 };
/** Native modulo/subtract floors the linear clock; triangles then select exactly one integer index. */
export function characterFrameOpacities(raw: Animated.Value, count: number) {
  if (count <= 1) return [1];
  const floor = Animated.subtract(raw, Animated.modulo(raw, 1));
  const index = floor.interpolate({ inputRange: [0,count-1,count], outputRange: [0,count-1,count-1], extrapolate: 'clamp' });
  return Array.from({ length: count }, (_, i) => index.interpolate({ inputRange: [i-1,i,i+1], outputRange: [0,1,0], extrapolate: 'clamp' }));
}
export type CharacterClock = { now: () => Date; setTimeout: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>; clearTimeout: (timer: ReturnType<typeof setTimeout>) => void };
export const systemCharacterClock: CharacterClock = { now: () => new Date(), setTimeout: (fn,ms) => setTimeout(fn,ms), clearTimeout: timer => clearTimeout(timer) };
export function isCharacterNight(date: Date) { return date.getHours() >= 22 || date.getHours() < 6; }
export function nextCharacterClockBoundary(date: Date) {
  const next = new Date(date);
  if (date.getHours() < 6) next.setHours(6,0,0,0);
  else if (date.getHours() < 22) next.setHours(22,0,0,0);
  else { next.setDate(next.getDate()+1); next.setHours(6,0,0,0); }
  return Math.max(1,next.getTime()-date.getTime());
}
