import type { CharacterSpecies } from './appearance';
import { tracedPixelFrames } from './pixelFrames.generated';
import { pixelFrameOverrides, dogPixelFrames, otherPixelFrame } from './pixelFrames.overrides';

export const pixelSlots = ['.', 'o', 'b', 's', 't', 'w', 'W', 'e', 'i', 'k', 'h', 'n', 'p', 'm'] as const;
export type PixelSlot = typeof pixelSlots[number];
export const pixelPoses = ['sit', 'blink', 'wave', 'sleep', 'stretch', 'walkRight', 'walkFront', 'walkBack', 'run', 'jump'] as const;
export type PixelPose = typeof pixelPoses[number] | 'walkSide';
export type PixelFrame = { pose: PixelPose; index: number; width: 48; height: 48; rows: readonly string[] };
export type PixelMask = { pose: PixelPose; index: number; rows: readonly string[] };
export const pixelClipLengths: Record<PixelPose, number> = { sit: 1, blink: 4, wave: 4, sleep: 4, stretch: 4, walkRight: 4, walkFront: 4, walkBack: 4, run: 1, jump: 1, walkSide: 4 };
export type CharacterPose = PixelPose | 'idle' | 'lift' | 'saveReact';
export type PixelDirection = 'front' | 'side' | 'back' | 'action';
export function pixelDirection(pose: PixelPose): PixelDirection {
  return pose === 'walkBack' ? 'back' : pose === 'jump' ? 'action' : ['walkRight', 'walkSide', 'sleep', 'stretch', 'run'].includes(pose) ? 'side' : 'front';
}
export function getPixelClip(species: CharacterSpecies, requested: CharacterPose = 'sit'): readonly PixelFrame[] {
  const pose = requested === 'idle' ? 'sit' : requested === 'lift' ? 'run' : requested === 'saveReact' ? 'stretch' : requested;
  if (species === 'other') return [otherPixelFrame];
  if (species === 'dog') {
    const dogPose = pose === 'walkRight' ? 'walkSide' : pose;
    const frames = dogPixelFrames.filter(frame => frame.pose === dogPose);
    return frames.length ? frames : dogPixelFrames.filter(frame => frame.pose === 'sit');
  }
  const catPose = pose === 'walkSide' ? 'walkRight' : pose;
  return tracedPixelFrames.filter(frame => frame.pose === catPose).map(frame => pixelFrameOverrides[`${frame.pose}:${frame.index}`] ?? frame);
}
export function getPixelFrame(species: CharacterSpecies, pose: CharacterPose = 'sit', index = 0): PixelFrame {
  const frames = getPixelClip(species, pose);
  return frames[((Math.trunc(index) % frames.length) + frames.length) % frames.length]!;
}
export function pixelBounds(rows: readonly string[]) {
  let left = 48, top = 48, right = -1, bottom = -1;
  rows.forEach((row, y) => [...row].forEach((slot, x) => { if (slot !== '.') { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); } }));
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 };
}
