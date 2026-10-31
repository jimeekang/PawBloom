import type { PixelFrame } from '../../apps/mobile/src/contexts/avatar/domain/pixelFrames';
import { sitOverrides } from './pixelFrameOverrides/sitOverrides';
import { blinkOverrides } from './pixelFrameOverrides/blinkOverrides';
import { waveOverrides } from './pixelFrameOverrides/waveOverrides';
import { sleepOverrides } from './pixelFrameOverrides/sleepOverrides';
import { stretchOverrides } from './pixelFrameOverrides/stretchOverrides';
import { walkRightOverrides } from './pixelFrameOverrides/walkRightOverrides';
import { walkFrontOverrides } from './pixelFrameOverrides/walkFrontOverrides';
import { walkBackOverrides } from './pixelFrameOverrides/walkBackOverrides';
import { runOverrides } from './pixelFrameOverrides/runOverrides';
import { jumpOverrides } from './pixelFrameOverrides/jumpOverrides';
import { dogSit } from './pixelFrameOverrides/dogSit';
import { dogBlink } from './pixelFrameOverrides/dogBlink';
import { dogWalkSide } from './pixelFrameOverrides/dogWalkSide';
import { dogSleep } from './pixelFrameOverrides/dogSleep';
import { otherFrames } from './pixelFrameOverrides/otherFrames';

// Full rows remain reviewable and independent of deterministic raw tracing.
const catFrames = [...sitOverrides, ...blinkOverrides, ...waveOverrides, ...sleepOverrides, ...stretchOverrides, ...walkRightOverrides, ...walkFrontOverrides, ...walkBackOverrides, ...runOverrides, ...jumpOverrides];
export const pixelFrameOverrides: Readonly<Record<string, PixelFrame>> = Object.fromEntries(catFrames.map(frame => [`${frame.pose}:${frame.index}`, frame]));
export const dogPixelFrames: readonly PixelFrame[] = [...dogSit, ...dogBlink, ...dogWalkSide, ...dogSleep];
export const otherPixelFrame = otherFrames[0]!;
export const pixelFrameCorrectionReasons: Readonly<Record<string, string>> = {
  "sit:0": "close one-pixel silhouette gaps after area sampling; restore source eye iris and glints at retained dark-eye clusters; restore eyeColor iris band and one mint/white glint per true eye ROI; remove non-eye iris artifacts; close shoulder/tail slit and remove obsolete interior contour hook",
  "blink:0": "register undersized reference silhouette to clip bbox tolerance; close one-pixel silhouette gaps after area sampling; restore source eye iris and glints at retained dark-eye clusters; restore eyeColor iris band and one mint/white glint per true eye ROI; remove non-eye iris artifacts; close shoulder/tail slit and remove obsolete interior contour hook",
  "blink:1": "register undersized reference silhouette to clip bbox tolerance; close one-pixel silhouette gaps after area sampling; restore source eye iris and glints at retained dark-eye clusters; restore eyeColor iris band and one mint/white glint per true eye ROI; remove non-eye iris artifacts; close shoulder/tail slit and remove obsolete interior contour hook",
  "blink:2": "close one-pixel silhouette gaps after area sampling; close shoulder/tail slit and remove obsolete interior contour hook; replace closed eyes with lead 10x3 stamp and opaque base-coat corners; remove old right-eye outline residue",
  "blink:3": "close one-pixel silhouette gaps after area sampling; restore source eye iris and glints at retained dark-eye clusters; restore eyeColor iris band and one mint/white glint per true eye ROI; remove non-eye iris artifacts; close shoulder/tail slit and remove obsolete interior contour hook",
  "wave:0": "close one-pixel silhouette gaps after area sampling; restore source eye iris and glints at retained dark-eye clusters; restore eyeColor iris band and one mint/white glint per true eye ROI; remove non-eye iris artifacts; close shoulder/tail slit and remove obsolete interior contour hook",
  "wave:1": "close one-pixel silhouette gaps after area sampling; restore source eye iris and glints at retained dark-eye clusters; restore eyeColor iris band and one mint/white glint per true eye ROI; remove non-eye iris artifacts; close shoulder/tail slit and remove obsolete interior contour hook",
  "wave:2": "close one-pixel silhouette gaps after area sampling; close shoulder/tail slit and remove obsolete interior contour hook",
  "wave:3": "close one-pixel silhouette gaps after area sampling; restore source eye iris and glints at retained dark-eye clusters; restore eyeColor iris band and one mint/white glint per true eye ROI; remove non-eye iris artifacts; close shoulder/tail slit and remove obsolete interior contour hook",
  "sleep:0": "close one-pixel silhouette gaps after area sampling",
  "sleep:1": "close one-pixel silhouette gaps after area sampling",
  "sleep:2": "close one-pixel silhouette gaps after area sampling",
  "sleep:3": "close one-pixel silhouette gaps after area sampling",
  "stretch:0": "register undersized reference silhouette to clip bbox tolerance; close one-pixel silhouette gaps after area sampling; restore source eye iris and glints at retained dark-eye clusters; restore eyeColor iris band and one mint/white glint per true eye ROI; remove non-eye iris artifacts",
  "stretch:1": "register undersized reference silhouette to clip bbox tolerance; close one-pixel silhouette gaps after area sampling; restore source eye iris and glints at retained dark-eye clusters; restore eyeColor iris band and one mint/white glint per true eye ROI; remove non-eye iris artifacts",
  "stretch:2": "close one-pixel silhouette gaps after area sampling",
  "stretch:3": "register undersized reference silhouette to clip bbox tolerance; close one-pixel silhouette gaps after area sampling; restore source eye iris and glints at retained dark-eye clusters; restore eyeColor iris band and one mint/white glint per true eye ROI; remove non-eye iris artifacts",
  "walkRight:0": "close one-pixel silhouette gaps after area sampling; restore source eye iris and glints at retained dark-eye clusters; restore eyeColor iris band and one mint/white glint per true eye ROI; remove non-eye iris artifacts",
  "walkRight:1": "close one-pixel silhouette gaps after area sampling; restore source eye iris and glints at retained dark-eye clusters; restore eyeColor iris band and one mint/white glint per true eye ROI; remove non-eye iris artifacts",
  "walkRight:2": "close one-pixel silhouette gaps after area sampling; restore source eye iris and glints at retained dark-eye clusters; restore eyeColor iris band and one mint/white glint per true eye ROI; remove non-eye iris artifacts",
  "walkRight:3": "close one-pixel silhouette gaps after area sampling; restore source eye iris and glints at retained dark-eye clusters; restore eyeColor iris band and one mint/white glint per true eye ROI; remove non-eye iris artifacts",
  "walkFront:0": "close one-pixel silhouette gaps after area sampling; restore source eye iris and glints at retained dark-eye clusters; restore eyeColor iris band and one mint/white glint per true eye ROI; remove non-eye iris artifacts",
  "walkFront:1": "close one-pixel silhouette gaps after area sampling; restore source eye iris and glints at retained dark-eye clusters; restore eyeColor iris band and one mint/white glint per true eye ROI; remove non-eye iris artifacts",
  "walkFront:2": "close one-pixel silhouette gaps after area sampling; restore source eye iris and glints at retained dark-eye clusters; restore eyeColor iris band and one mint/white glint per true eye ROI; remove non-eye iris artifacts",
  "walkFront:3": "close one-pixel silhouette gaps after area sampling; restore source eye iris and glints at retained dark-eye clusters; restore eyeColor iris band and one mint/white glint per true eye ROI; remove non-eye iris artifacts",
  "run:0": "close one-pixel silhouette gaps after area sampling; restore source eye iris and glints at retained dark-eye clusters; restore eyeColor iris band and one mint/white glint per true eye ROI; remove non-eye iris artifacts",
  "jump:0": "close one-pixel silhouette gaps after area sampling; restore source eye iris and glints at retained dark-eye clusters; restore eyeColor iris band and one mint/white glint per true eye ROI; remove non-eye iris artifacts"
};
for (const frame of catFrames) {
  const id = `${frame.pose}:${frame.index}`;
  (pixelFrameCorrectionReasons as Record<string, string>)[id] = `${pixelFrameCorrectionReasons[id] ?? 'retain traced registration'}; remove isolated tabby/white sampling speckles; preserve eye glints outside coat cleanup${frame.pose === 'blink' && (frame.index === 1 || frame.index === 2) ? '; restore pale brow band to base coat while preserving half/closed eye shape' : ''}`;
  if (['sit','blink','wave','walkRight','walkFront','run','jump'].includes(frame.pose) || frame.pose === 'stretch' && frame.index !== 2) {
    (pixelFrameCorrectionReasons as Record<string,string>)[id] += '; P1d lead-fixed dark pupil stamp, lower iris crescent and internal mint2x2/white1 glints; aligned frontal nose';
  }
}
export const pixelP1dCorrection = 'Replace open and half eyes with lead-fixed stamps; preserve closed arcs and sleeping eyes, center nose and stable collar; locally support the wider jump stamp with a closed cheek.';
export const correctedPixelFrameIds = Object.keys(pixelFrameCorrectionReasons);
