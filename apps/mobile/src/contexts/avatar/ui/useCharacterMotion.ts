import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState } from 'react-native';
import { getPixelClip, type PixelPose } from '../domain/pixelFrames';
import { characterFrameOpacities } from './characterClipMotion';
import { createCharacterMotionController, type CharacterMotionOptions, type CharacterMotionConfig, type CharacterMotionValues } from './characterMotionController';
export type { CharacterMotionOptions } from './characterMotionController';

/** React changes only when the selected clip or a lifecycle gate changes; frame ticks stay in Animated. */
export function useCharacterMotion(options: CharacterMotionOptions, config: CharacterMotionConfig = {}) {
  const internal = useRef<CharacterMotionValues | null>(null);
  if (!internal.current) internal.current = { frame:new Animated.Value(0),wander:options.wanderOffset ?? new Animated.Value(0),direction:new Animated.Value(1),lift:new Animated.Value(0),opacity:new Animated.Value(1) };
  const values = useMemo(() => ({...internal.current!,wander:options.wanderOffset ?? internal.current!.wander}),[options.wanderOffset]);
  const [pose,setPose] = useState<PixelPose>('sit');
  const [active,setActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const controller = useMemo(() => createCharacterMotionController(values,setPose),[values]);
  useEffect(() => { const subscription = AppState.addEventListener('change',state => setActive(state === 'active')); return () => subscription.remove(); },[]);
  // Option changes update in place (no stop in between, so lift/fade/wander never snap); only unmount stops hard.
  useEffect(() => () => controller.stop(),[controller]);
  useEffect(() => {
    controller.update(options,{...config,active});
  },[controller,options.id,options.enabled,options.paused,options.reduced,options.lifted,options.tap,options.saved,options.reveal,config.species,config.pose,config.clock,active]);
  const frames = getPixelClip(config.species ?? 'cat',pose);
  const opacities = useMemo(() => characterFrameOpacities(values.frame,frames.length),[values.frame,frames.length]);
  return {values,pose,opacities,frames};
}
