import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Platform } from "react-native";
import { hashSeed } from "../domain/appearance";

const useNativeDriver = Platform.OS !== "web";
const timing = (value: Animated.Value, toValue: number, duration: number) => Animated.timing(value, { toValue, duration, easing: Easing.inOut(Easing.quad), useNativeDriver, isInteraction: false });
export type CharacterMotionOptions = { id: string; enabled: boolean; paused: boolean; reduced: boolean; lifted?: boolean; tap?: number; saved?: number; reveal?: boolean; wanderOffset?: Animated.Value };

/** Only Animated values change per frame. React state is used for the one-shot smile. */
export function useCharacterMotion({ id, enabled, paused, reduced, lifted = false, tap = 0, saved = 0, reveal = false, wanderOffset }: CharacterMotionOptions) {
  const internalValues = useRef({ breathe: new Animated.Value(0), blink: new Animated.Value(1), tail: new Animated.Value(0), ear: new Animated.Value(0), wander: new Animated.Value(0), direction: new Animated.Value(1), bounce: new Animated.Value(0), sit: new Animated.Value(0), lift: new Animated.Value(0), tap: new Animated.Value(1), opacity: new Animated.Value(1), jump: new Animated.Value(0), reveal: new Animated.Value(1) }).current;
  // A scene label can share the exact driver without another loop or React frame updates.
  const values = useMemo(() => wanderOffset ? { ...internalValues, wander: wanderOffset } : internalValues, [internalValues, wanderOffset]);
  const [smiling, setSmiling] = useState(false);
  const [blushing, setBlushing] = useState(false);
  const seed = hashSeed(id);
  useEffect(() => {
    if (!enabled || reduced) return;
    const blinkOnce = () => Animated.sequence([timing(values.blink, 0.1, 70), timing(values.blink, 1, 120)]);
    const loops = [
      Animated.loop(Animated.sequence([timing(values.breathe, 1, 1200), timing(values.breathe, 0, 1200)])),
      Animated.loop(Animated.sequence([Animated.delay(2400 + seed % 1601), blinkOnce(), ...(seed % 100 < 12 ? [Animated.delay(120), blinkOnce()] : [])])),
      Animated.loop(Animated.sequence([Animated.delay(6000 + seed % 6001), timing(values.ear, 1, 120), timing(values.ear, -1, 120), timing(values.ear, 0, 120)])),
    ];
    loops.forEach((loop) => loop.start());
    return () => { loops.forEach((loop) => loop.stop()); values.breathe.setValue(0); values.blink.setValue(1); values.ear.setValue(0); };
  }, [enabled, reduced, seed, values]);
  useEffect(() => {
    if (!enabled || reduced) return;
    const duration = lifted ? 450 : 900;
    const loop = Animated.loop(Animated.sequence([timing(values.tail, -1, duration), timing(values.tail, 1, duration)]));
    loop.start();
    return () => { loop.stop(); values.tail.setValue(0); };
  }, [enabled, reduced, lifted, values]);
  useEffect(() => {
    if (!enabled || paused || reduced) return;
    const walk = (x: number, direction: number, duration: number) => Animated.sequence([
      timing(values.direction, direction, 0),
      Animated.parallel([timing(values.wander, x, duration), Animated.loop(Animated.sequence([timing(values.bounce, 1, 150), timing(values.bounce, 0, 150)]), { iterations: Math.floor(duration / 300) })]),
    ]);
    const roam = Animated.loop(Animated.sequence([Animated.delay(600 + seed % 901), walk(16, 1, 2200), Animated.delay(900), walk(-16, -1, 2800), Animated.delay(700), walk(0, 1, 1800)]));
    const sit = Animated.loop(Animated.sequence([Animated.delay(4200 + seed % 2601), timing(values.sit, 1, 380), Animated.delay(1700), timing(values.sit, 0, 420)]));
    roam.start(); sit.start();
    return () => { roam.stop(); sit.stop(); values.wander.setValue(0); values.sit.setValue(0); values.bounce.setValue(0); values.direction.setValue(1); };
  }, [enabled, paused, reduced, seed, values]);
  useEffect(() => {
    if (reduced) { values.lift.setValue(0); return; }
    const animation = Animated.spring(values.lift, { toValue: lifted ? 1 : 0, friction: 6, tension: 120, useNativeDriver, isInteraction: false });
    animation.start(); return () => animation.stop();
  }, [lifted, reduced, values]);
  useEffect(() => {
    if (!tap) return;
    // Like the smile, swap two static SVG frames only at event boundaries.
    setBlushing(true);
    const timer = setTimeout(() => setBlushing(false), 320);
    const animation = Animated.parallel([
      Animated.sequence([timing(values.opacity, 0.7, 80), timing(values.opacity, 1, 240)]),
      ...(reduced ? [] : [Animated.sequence([timing(values.tap, 0.9, 80), timing(values.tap, 1.05, 120), timing(values.tap, 1, 120)])]),
    ]);
    animation.start(); return () => { clearTimeout(timer); setBlushing(false); animation.stop(); values.tap.setValue(1); values.opacity.setValue(1); };
  }, [tap, reduced, values]);
  useEffect(() => {
    if (!saved) return;
    setSmiling(true);
    const animation = Animated.sequence([timing(values.jump, reduced ? 0 : -8, 200), timing(values.jump, 0, 200)]);
    animation.start(); const timer = setTimeout(() => setSmiling(false), 1200);
    return () => { clearTimeout(timer); animation.stop(); values.jump.setValue(0); setSmiling(false); };
  }, [saved, reduced, values]);
  useEffect(() => {
    if (!reveal || reduced) return;
    values.reveal.setValue(0.8); values.opacity.setValue(0);
    const animation = Animated.parallel([Animated.sequence([timing(values.reveal, 1.04, 360), timing(values.reveal, 1, 240)]), timing(values.opacity, 1, 600)]);
    animation.start(); return () => { animation.stop(); values.reveal.setValue(1); values.opacity.setValue(1); };
  }, [reveal, reduced, values]);
  return { values, smiling, blushing };
}
