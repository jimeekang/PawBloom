import { useEffect, useRef } from "react";
import { Animated, Easing, Image, Platform, StyleSheet, Text, View } from "react-native";
import type { PetProfile } from "../../contexts/pet/domain/pet";
import { AppIcon } from "../../design-system/iconography";
import { colors, font, iconSize, radius, sceneColors, spacing, type } from "../../design-system/tokens";
import { DefaultPetCharacter, defaultCharacterCanvas } from "./DefaultPetCharacter";
import { usePetPhoto } from "./PetAvatar";

const nativeDriver = Platform.OS !== "web";

export type HouseCharacterProps = {
  pet: Pick<PetProfile, "id" | "name" | "species">;
  userId: string | null;
  /** Head size in px. */
  size: number;
  /** All idle motion (blink, wander, sit) runs only while true. */
  motionEnabled: boolean;
  /** Wandering/sitting stop while the pet is dragged or its summary is open. */
  wanderPaused: boolean;
  /** Raised while dragged so the move is visible without frame-by-frame state. */
  lifted: boolean;
  /** Record-target selection ring. */
  selected: boolean;
};

/** Visual only: gestures and accessibility live on the scene slot that wraps it. */
export function HouseCharacter({ pet, userId, size, motionEnabled, wanderPaused, lifted, selected }: HouseCharacterProps) {
  const photoUrl = usePetPhoto(pet.id, userId);
  const seed = useRef(hashSeed(pet.id)).current;
  const blink = useRef(new Animated.Value(1)).current;
  const wander = useRef(new Animated.Value(0)).current;
  const sit = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!motionEnabled) { blink.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(2400 + (seed % 1600)),
      Animated.timing(blink, { toValue: 0.12, duration: 70, useNativeDriver: nativeDriver }),
      Animated.timing(blink, { toValue: 1, duration: 120, useNativeDriver: nativeDriver }),
    ]));
    loop.start();
    return () => { loop.stop(); blink.setValue(1); };
  }, [motionEnabled, blink, seed]);

  useEffect(() => {
    if (!motionEnabled || wanderPaused) { wander.setValue(0); sit.setValue(0); return; }
    const ease = Easing.inOut(Easing.quad);
    const step = (value: Animated.Value, toValue: number, duration: number) => Animated.timing(value, { toValue, duration, easing: ease, useNativeDriver: nativeDriver });
    const roam = Animated.loop(Animated.sequence([
      Animated.delay(600 + (seed % 900)),
      step(wander, 1, 2200), Animated.delay(900),
      step(wander, -1, 2800), Animated.delay(700),
      step(wander, 0, 1800),
    ]));
    const rest = Animated.loop(Animated.sequence([
      Animated.delay(4200 + (seed % 2600)),
      step(sit, 1, 380), Animated.delay(1700), step(sit, 0, 420),
    ]));
    roam.start(); rest.start();
    return () => { roam.stop(); rest.stop(); wander.setValue(0); sit.setValue(0); };
  }, [motionEnabled, wanderPaused, wander, sit, seed]);

  useEffect(() => {
    Animated.spring(lift, { toValue: lifted ? 1 : 0, friction: 6, tension: 120, useNativeDriver: nativeDriver }).start();
  }, [lifted, lift]);

  const canvas = defaultCharacterCanvas(size, true);
  const outer = { transform: [
    { translateX: wander.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] }) },
    { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
    { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
  ] };
  const sitting = { transform: [
    { translateY: sit.interpolate({ inputRange: [0, 1], outputRange: [0, canvas.height * 0.04] }) },
    { scaleY: sit.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] }) },
  ] };
  const photoSize = size * 1.12;
  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, outer]}>
      <View style={canvas}>
        <View style={[styles.groundShadow, { left: (canvas.width - size * 0.95) / 2, top: canvas.height - size * 0.12, width: size * 0.95, height: size * 0.18, borderRadius: size }]} />
        <Animated.View style={[StyleSheet.absoluteFill, sitting]}>
          {photoUrl
            ? <Image source={{ uri: photoUrl }} accessibilityIgnoresInvertColors style={[styles.photo, { width: photoSize, height: photoSize, borderRadius: photoSize / 2, left: (canvas.width - photoSize) / 2, top: canvas.height - photoSize - size * 0.06 }]} />
            : <DefaultPetCharacter species={pet.species} size={size} blink={blink} withBody />}
        </Animated.View>
      </View>
      <View style={[styles.nameTag, selected && styles.nameTagSelected]}>
        {selected ? <AppIcon name="check" size={iconSize.xs} color={colors.orangeDeep} /> : null}
        <Text style={styles.nameText} numberOfLines={1}>{pet.name}</Text>
      </View>
    </Animated.View>
  );
}

/** Stable per-pet offset so several pets never blink or wander in sync. */
function hashSeed(id: string) {
  let value = 0;
  for (const char of id) value = (value * 31 + char.charCodeAt(0)) % 9973;
  return value;
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    alignItems: "center",
  },
  groundShadow: {
    position: "absolute",
    backgroundColor: sceneColors.groundShadow,
  },
  photo: {
    position: "absolute",
    borderWidth: 3,
    borderColor: colors.white,
    backgroundColor: colors.surfaceWarm,
  },
  nameTag: {
    marginTop: spacing.xxs,
    maxWidth: "100%",
    minHeight: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: sceneColors.nameTag,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
  },
  nameTagSelected: {
    borderWidth: 2,
    borderColor: colors.orange,
  },
  nameText: {
    ...type.caption,
    flexShrink: 1,
    color: colors.text,
    fontWeight: font.weight.semibold,
  },
});
