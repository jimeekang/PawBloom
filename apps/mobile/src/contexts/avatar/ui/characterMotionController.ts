import { Animated, Easing, Platform } from 'react-native';
import { hashSeed, type CharacterSpecies } from '../domain/appearance';
import { getPixelClip, type CharacterPose, type PixelPose } from '../domain/pixelFrames';
import { characterClipFps, isCharacterNight, nextCharacterClockBoundary, systemCharacterClock, type CharacterClock } from './characterClipMotion';

export type CharacterMotionOptions = { id: string; enabled: boolean; paused: boolean; reduced: boolean; lifted?: boolean; tap?: number; saved?: number; reveal?: boolean; wanderOffset?: Animated.Value };
export type CharacterMotionConfig = { species?: CharacterSpecies; pose?: CharacterPose; clock?: CharacterClock; active?: boolean };
export type CharacterMotionValues = { frame: Animated.Value; wander: Animated.Value; direction: Animated.Value; lift: Animated.Value; opacity: Animated.Value };
const native = Platform.OS !== 'web';
/** Largest sideways wander offset; scenes reserve this on both sides of every slot. */
export const characterWanderReach = 16;
/** One-shot reaction length in ms (jump is a fixed hop); screens time follow-ups (e.g. the summary sheet) from it. */
export function characterReactionDuration(species: CharacterSpecies, pose: 'wave' | 'stretch' | 'jump') {
  return pose === 'jump' ? 600 : getPixelClip(species,pose).length*1000/(characterClipFps[pose] ?? 6);
}
export function createCharacterMotionController(values: CharacterMotionValues, setPose: (pose: PixelPose) => void) {
  let options: CharacterMotionOptions, config: CharacterMotionConfig = {}, pose: PixelPose = 'sit';
  let clock = systemCharacterClock, generation = 0;
  let previous = { tap: 0, saved: 0, reveal: false }, reaction: { pose: PixelPose; start: number; until: number } | undefined;
  let clip: Animated.CompositeAnimation | undefined;
  // Lift, fade and wander-return outlive soft restarts so an unrelated option change never snaps them.
  let liftTarget = 0, liftAnim: Animated.CompositeAnimation | undefined, fadeAnim: Animated.CompositeAnimation | undefined, settleAnim: Animated.CompositeAnimation | undefined;
  const idleTimers = new Set<ReturnType<typeof setTimeout>>();
  const timers = new Set<ReturnType<typeof setTimeout>>(), animations = new Set<Animated.CompositeAnimation>();
  function timer(fn: () => void, delay: number) {
    const epoch = generation;
    const id = clock.setTimeout(() => { timers.delete(id); idleTimers.delete(id); if (epoch === generation) fn(); },delay);
    timers.add(id); return id;
  }
  function animate(animation: Animated.CompositeAnimation) { animations.add(animation); animation.start(() => animations.delete(animation)); return animation; }
  function timing(value: Animated.Value, toValue: number, duration: number) { return Animated.timing(value, { toValue,duration,easing:Easing.linear,useNativeDriver:native,isInteraction:false }); }
  /** Soft: cancel timers, the clip and the walk; leave lift, fade and the wander position where they are. */
  function cancel() {
    generation++; timers.forEach(id => clock.clearTimeout(id)); timers.clear(); idleTimers.clear();
    animations.forEach(a => a.stop()); animations.clear(); clip = undefined;
  }
  /** Hard: unmount/background. Everything stops and returns to rest immediately. */
  function stop() {
    cancel(); [liftAnim,fadeAnim,settleAnim].forEach(a => a?.stop()); liftAnim = fadeAnim = settleAnim = undefined; liftTarget = 0;
    values.frame.setValue(0); values.wander.setValue(0); values.direction.setValue(1); values.lift.setValue(0); values.opacity.setValue(1);
  }
  function own(animation: Animated.CompositeAnimation) { animation.start(); return animation; }
  /** Wander eases home instead of jumping (drag start, summary open); reduced motion has no travel at all. */
  function settleWander() {
    settleAnim?.stop();
    if (options.reduced) { settleAnim = undefined; values.wander.setValue(0); return; }
    settleAnim = own(timing(values.wander,0,200));
  }
  function setLift(target: number) {
    if (options.reduced) { liftAnim?.stop(); liftAnim = undefined; liftTarget = 0; values.lift.setValue(0); return; }
    if (target === liftTarget) return;
    liftTarget = target; liftAnim?.stop();
    // Pick-up and drop share v2's spring so a released pet settles back down instead of snapping.
    liftAnim = own(Animated.spring(values.lift,{ toValue:target,friction:6,tension:120,useNativeDriver:native,isInteraction:false }));
  }
  /** startedAt resumes a one-shot clip where it was when an unrelated gate (e.g. summary pause) restarted motion. */
  function play(next: PixelPose, loop = false, startedAt?: number) {
    if (clip) { clip.stop(); animations.delete(clip); }
    const count = getPixelClip(config.species ?? 'cat',next).length, fps = characterClipFps[next] ?? 6;
    const from = loop || startedAt === undefined ? 0 : Math.min(count-1, Math.max(0, (clock.now().getTime()-startedAt)*fps/1000));
    values.frame.setValue(from);
    if (pose !== next) { pose = next; setPose(next); }
    if (count <= 1 || options.reduced || config.active === false || !options.enabled && !reaction) { clip = undefined; return; }
    const animation = timing(values.frame,count,(count-from)*1000/fps);
    clip = loop ? Animated.loop(animation, { resetBeforeIteration: true }) : animation;
    animate(clip);
  }
  function fade(reveal = false) {
    fadeAnim?.stop();
    // v2: reduced motion skips the reveal fade entirely; tap/save keep their opacity-only dip.
    if (reveal && options.reduced) { fadeAnim = undefined; values.opacity.setValue(1); return; }
    if (reveal) { values.opacity.setValue(0); fadeAnim = own(timing(values.opacity,1,600)); }
    else fadeAnim = own(Animated.sequence([timing(values.opacity,.7,80),timing(values.opacity,1,240)]));
  }
  const resolvedPose = (): PixelPose | undefined => {
    const selected = config.pose;
    return selected === 'idle' ? 'sit' : selected === 'lift' ? 'run' : selected === 'saveReact' ? 'stretch' : selected === 'walkSide' ? 'walkRight' : selected;
  };
  function idle() {
    values.direction.setValue(1);
    const selected = resolvedPose();
    const rest: PixelPose = selected ?? (isCharacterNight(clock.now()) ? 'sleep' : 'sit');
    play(rest,rest !== 'sit');
    if (!options.enabled || rest !== 'sit') return;
    idleTimers.add(timer(() => { play('blink'); idleTimers.add(timer(idle,400)); },2400+hashSeed(options.id)%1601));
  }
  function base() {
    // Only a walk step may face left; reactions, lifts and rests always face forward. walk() sets its own direction.
    values.direction.setValue(1);
    // Reduced motion and background stay still; an explicitly chosen preview pose shows its first frame, never sit-for-all.
    if (options.reduced || config.active === false) { play(resolvedPose() ?? 'sit'); settleWander(); return; }
    if (options.lifted) { play('run'); settleWander(); return; }
    if (reaction && reaction.until > clock.now().getTime()) {
      play(reaction.pose,false,reaction.start); settleWander();
      timer(() => { reaction = undefined; restart(); },reaction.until-clock.now().getTime()); return;
    }
    reaction = undefined;
    if (!options.enabled) { play(resolvedPose() ?? 'sit'); settleWander(); return; }
    idle();
    timer(restart,nextCharacterClockBoundary(clock.now()));
    // Night (local 22:00–06:00) is sleep only: no wander. The boundary timer above restarts motion at 06:00.
    if (options.paused || config.pose !== undefined || isCharacterNight(clock.now())) { settleWander(); return; }
    settleAnim?.stop(); settleAnim = undefined;
    const seed = hashSeed(options.id), phases = [{x:characterWanderReach,direction:1,duration:2200,wait:900},{x:-characterWanderReach,direction:-1,duration:2800,wait:700},{x:0,direction:1,duration:1800,wait:600+seed%901}];
    function walk(index: number) {
      const step = phases[index]!;
      // Starting a walk cancels idle's blink timers while preserving the room's shared position driver.
      idleTimers.forEach(id => { clock.clearTimeout(id); timers.delete(id); }); idleTimers.clear();
      play('walkRight',true); values.direction.setValue(step.direction);
      animate(timing(values.wander,step.x,step.duration));
      timer(() => { idle(); timer(() => walk((index+1)%phases.length),step.wait); },step.duration);
    }
    timer(() => walk(0),600+seed%901);
  }
  function restart() { cancel(); base(); }
  function update(next: CharacterMotionOptions, nextConfig: CharacterMotionConfig = {}) {
    cancel(); options = next; config = nextConfig; clock = config.clock ?? systemCharacterClock;
    const tap = next.tap ?? 0, saved = next.saved ?? 0, reveal = next.reveal ?? false;
    const event = reveal && !previous.reveal ? 'jump' : saved && saved !== previous.saved ? 'stretch' : tap && tap !== previous.tap ? 'wave' : undefined;
    if (!reveal && previous.reveal && reaction?.pose === 'jump') reaction = undefined;
    previous = {tap,saved,reveal};
    if (config.active === false) { stop(); reaction = undefined; play('sit'); return; }
    setLift(next.lifted ? 1 : 0);
    const rank = (pose: PixelPose) => pose === 'jump' ? 3 : pose === 'stretch' ? 2 : 1;
    if (event && (!reaction || reaction.until <= clock.now().getTime() || rank(event) >= rank(reaction.pose))) {
      const duration = characterReactionDuration(config.species ?? 'cat',event);
      reaction = next.reduced ? undefined : { pose: event, start: clock.now().getTime(), until: clock.now().getTime()+duration };
      fade(event === 'jump');
    }
    if (next.reduced) reaction = undefined;
    base();
  }
  return { update,stop, get pose() { return pose; } };
}
