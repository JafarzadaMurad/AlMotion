import type { AnimatableProperty, EasingType } from '@/types/keyframe';
import type { ResolvedTransform } from '@/types/transform';

/**
 * Camera-move presets (Ken Burns and friends), expressed as keyframes.
 *
 * These are deliberately not shader effects: a pan or a zoom is a transform
 * changing over time, which the keyframe system already interpolates, renders
 * and exports. Building on it means the moves need no GPU — they work on
 * machines with no WebGPU adapter — and the generated keyframes stay editable
 * by hand afterwards instead of being an opaque black box.
 */

export type MotionPresetId =
  | 'zoom-in'
  | 'zoom-out'
  | 'pan-left'
  | 'pan-right'
  | 'pan-up'
  | 'pan-down'
  | 'ken-burns'
  | 'fade-in'
  | 'fade-out';

export interface MotionPreset {
  id: MotionPresetId;
  label: string;
  /** One line describing the move, shown as the button tooltip. */
  description: string;
}

export const MOTION_PRESETS: MotionPreset[] = [
  { id: 'zoom-in', label: 'Zoom In', description: 'Push slowly towards the centre' },
  { id: 'zoom-out', label: 'Zoom Out', description: 'Pull back to the full frame' },
  { id: 'pan-left', label: 'Pan Left', description: 'Drift across the frame to the left' },
  { id: 'pan-right', label: 'Pan Right', description: 'Drift across the frame to the right' },
  { id: 'pan-up', label: 'Pan Up', description: 'Drift up the frame' },
  { id: 'pan-down', label: 'Pan Down', description: 'Drift down the frame' },
  { id: 'ken-burns', label: 'Ken Burns', description: 'Zoom in while drifting diagonally' },
  { id: 'fade-in', label: 'Fade In', description: 'Rise from transparent to full' },
  { id: 'fade-out', label: 'Fade Out', description: 'Fall from full to transparent' },
];

/** A keyframe to create, in the shape the keyframe actions accept. */
export interface MotionKeyframe {
  itemId: string;
  property: AnimatableProperty;
  frame: number;
  value: number;
  easing: EasingType;
}

export interface MotionPresetInput {
  preset: MotionPresetId;
  itemId: string;
  /** Clip length in frames. The move spans the whole clip. */
  durationInFrames: number;
  /** The item's current transform — the move is applied relative to it. */
  base: ResolvedTransform;
  /**
   * How far the move travels, as a fraction of the base size. 0.15 means the
   * clip scales to 115%, which is the usual documentary-style amount.
   */
  intensity: number;
  easing: EasingType;
}

/** Sensible default: noticeable on a 3-5s clip without looking like a zoom effect. */
export const DEFAULT_MOTION_INTENSITY = 0.15;
export const DEFAULT_MOTION_EASING: EasingType = 'ease-in-out';

const clampIntensity = (value: number): number => Math.min(1, Math.max(0.01, value));

/**
 * Build the keyframes for one preset.
 *
 * Returns an empty array for clips too short to animate — a move needs a first
 * and a last frame, and a one-frame clip has only the one.
 *
 * Pan presets scale the clip up before moving it. Panning at 100% would slide
 * the frame off its own edges and expose the background; the overscan from the
 * scale is what the pan travels through, which is how the move is done in an
 * NLE.
 */
export function buildMotionPresetKeyframes(input: MotionPresetInput): MotionKeyframe[] {
  const { preset, itemId, durationInFrames, base, easing } = input;

  if (!Number.isFinite(durationInFrames) || durationInFrames < 2) return [];

  const intensity = clampIntensity(input.intensity);
  const firstFrame = 0;
  // Keyframes are relative to the item start, so the final frame is the last
  // one that renders, not the exclusive end.
  const lastFrame = Math.max(1, Math.round(durationInFrames) - 1);

  const at = (property: AnimatableProperty, frame: number, value: number): MotionKeyframe => ({
    itemId, property, frame, value, easing,
  });

  const scaledWidth = base.width * (1 + intensity);
  const scaledHeight = base.height * (1 + intensity);
  // Half the overscan is how far the clip can travel before an edge shows.
  const travelX = (scaledWidth - base.width) / 2;
  const travelY = (scaledHeight - base.height) / 2;

  /** Hold the clip scaled up for the whole move, so a pan has room to travel. */
  const heldScale = (): MotionKeyframe[] => [
    at('width', firstFrame, scaledWidth),
    at('width', lastFrame, scaledWidth),
    at('height', firstFrame, scaledHeight),
    at('height', lastFrame, scaledHeight),
  ];

  switch (preset) {
    case 'zoom-in':
      return [
        at('width', firstFrame, base.width),
        at('width', lastFrame, scaledWidth),
        at('height', firstFrame, base.height),
        at('height', lastFrame, scaledHeight),
      ];

    case 'zoom-out':
      return [
        at('width', firstFrame, scaledWidth),
        at('width', lastFrame, base.width),
        at('height', firstFrame, scaledHeight),
        at('height', lastFrame, base.height),
      ];

    // The clip moves opposite to the camera: to look left, the image slides right.
    case 'pan-left':
      return [
        ...heldScale(),
        at('x', firstFrame, base.x - travelX),
        at('x', lastFrame, base.x + travelX),
      ];

    case 'pan-right':
      return [
        ...heldScale(),
        at('x', firstFrame, base.x + travelX),
        at('x', lastFrame, base.x - travelX),
      ];

    case 'pan-up':
      return [
        ...heldScale(),
        at('y', firstFrame, base.y - travelY),
        at('y', lastFrame, base.y + travelY),
      ];

    case 'pan-down':
      return [
        ...heldScale(),
        at('y', firstFrame, base.y + travelY),
        at('y', lastFrame, base.y - travelY),
      ];

    case 'ken-burns':
      // Zoom and drift at once. The drift uses the overscan the zoom creates,
      // so it is measured against the final scale and starts from centre.
      return [
        at('width', firstFrame, base.width),
        at('width', lastFrame, scaledWidth),
        at('height', firstFrame, base.height),
        at('height', lastFrame, scaledHeight),
        at('x', firstFrame, base.x),
        at('x', lastFrame, base.x - travelX),
        at('y', firstFrame, base.y),
        at('y', lastFrame, base.y - travelY),
      ];

    case 'fade-in':
      return [
        at('opacity', firstFrame, 0),
        at('opacity', lastFrame, base.opacity || 1),
      ];

    case 'fade-out':
      return [
        at('opacity', firstFrame, base.opacity || 1),
        at('opacity', lastFrame, 0),
      ];

    default:
      return [];
  }
}

/** Properties a preset writes to — used to clear a previous move before applying a new one. */
export function getMotionPresetProperties(preset: MotionPresetId): AnimatableProperty[] {
  switch (preset) {
    case 'zoom-in':
    case 'zoom-out':
      return ['width', 'height'];
    case 'pan-left':
    case 'pan-right':
      return ['width', 'height', 'x'];
    case 'pan-up':
    case 'pan-down':
      return ['width', 'height', 'y'];
    case 'ken-burns':
      return ['width', 'height', 'x', 'y'];
    case 'fade-in':
    case 'fade-out':
      return ['opacity'];
    default:
      return [];
  }
}
