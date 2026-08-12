import { describe, it, expect } from 'vitest';
import type { ResolvedTransform } from '@/types/transform';
import {
  MOTION_PRESETS,
  buildMotionPresetKeyframes,
  getMotionPresetProperties,
  DEFAULT_MOTION_INTENSITY,
  type MotionPresetId,
} from './motion-presets';

const base: ResolvedTransform = {
  x: 0, y: 0, width: 1920, height: 1080, rotation: 0, opacity: 1, cornerRadius: 0,
};

function build(preset: MotionPresetId, overrides: Partial<Parameters<typeof buildMotionPresetKeyframes>[0]> = {}) {
  return buildMotionPresetKeyframes({
    preset,
    itemId: 'item-1',
    durationInFrames: 90,
    base,
    intensity: DEFAULT_MOTION_INTENSITY,
    easing: 'ease-in-out',
    ...overrides,
  });
}

const valueAt = (kfs: ReturnType<typeof build>, property: string, frame: number) =>
  kfs.find((k) => k.property === property && k.frame === frame)?.value;

describe('buildMotionPresetKeyframes', () => {
  it('spans the clip from its first to its last rendered frame', () => {
    const kfs = build('zoom-in');
    const frames = [...new Set(kfs.map((k) => k.frame))].sort((a, b) => a - b);
    // 90 frames render 0..89, so the move must land on 89, not 90.
    expect(frames).toEqual([0, 89]);
  });

  it('refuses clips too short to animate', () => {
    expect(build('zoom-in', { durationInFrames: 1 })).toEqual([]);
    expect(build('zoom-in', { durationInFrames: 0 })).toEqual([]);
    expect(build('zoom-in', { durationInFrames: Number.NaN })).toEqual([]);
  });

  it('zooms in from the base size to the scaled size', () => {
    const kfs = build('zoom-in');
    expect(valueAt(kfs, 'width', 0)).toBe(1920);
    expect(valueAt(kfs, 'width', 89)).toBeCloseTo(1920 * 1.15);
    expect(valueAt(kfs, 'height', 89)).toBeCloseTo(1080 * 1.15);
  });

  it('zooms out as the exact mirror of zooming in', () => {
    const inKfs = build('zoom-in');
    const outKfs = build('zoom-out');
    expect(valueAt(outKfs, 'width', 0)).toBe(valueAt(inKfs, 'width', 89));
    expect(valueAt(outKfs, 'width', 89)).toBe(valueAt(inKfs, 'width', 0));
  });

  it('holds a scale through a pan so no edge is exposed', () => {
    const kfs = build('pan-left');
    // Panning at 100% would slide the frame off itself; the overscan is what
    // the pan travels through, so width must stay scaled at both ends.
    expect(valueAt(kfs, 'width', 0)).toBeCloseTo(1920 * 1.15);
    expect(valueAt(kfs, 'width', 89)).toBeCloseTo(1920 * 1.15);
  });

  it('keeps a pan inside the overscan it created', () => {
    const kfs = build('pan-left');
    const travel = (1920 * 1.15 - 1920) / 2;
    expect(valueAt(kfs, 'x', 0)).toBeCloseTo(-travel);
    expect(valueAt(kfs, 'x', 89)).toBeCloseTo(travel);
  });

  it('pans in opposite directions for opposite presets', () => {
    const left = build('pan-left');
    const right = build('pan-right');
    expect(valueAt(left, 'x', 0)).toBeCloseTo(-(valueAt(right, 'x', 0) as number));
    expect(valueAt(left, 'x', 89)).toBeCloseTo(-(valueAt(right, 'x', 89) as number));
  });

  it('pans vertically on the y axis and leaves x alone', () => {
    const kfs = build('pan-up');
    expect(kfs.some((k) => k.property === 'y')).toBe(true);
    expect(kfs.some((k) => k.property === 'x')).toBe(false);
  });

  it('moves and scales together for ken burns', () => {
    const kfs = build('ken-burns');
    expect(valueAt(kfs, 'width', 0)).toBe(1920);
    expect(valueAt(kfs, 'width', 89)).toBeCloseTo(1920 * 1.15);
    // Starts centred and drifts, rather than starting off-centre.
    expect(valueAt(kfs, 'x', 0)).toBe(0);
    expect(valueAt(kfs, 'x', 89)).not.toBe(0);
    expect(valueAt(kfs, 'y', 89)).not.toBe(0);
  });

  it('fades between transparent and the item opacity', () => {
    expect(valueAt(build('fade-in'), 'opacity', 0)).toBe(0);
    expect(valueAt(build('fade-in'), 'opacity', 89)).toBe(1);
    expect(valueAt(build('fade-out'), 'opacity', 89)).toBe(0);
  });

  it('respects an item that is already partly transparent', () => {
    const kfs = build('fade-in', { base: { ...base, opacity: 0.6 } });
    expect(valueAt(kfs, 'opacity', 89)).toBe(0.6);
  });

  it('scales the travel with intensity', () => {
    const gentle = build('zoom-in', { intensity: 0.05 });
    const strong = build('zoom-in', { intensity: 0.5 });
    expect(valueAt(strong, 'width', 89)).toBeGreaterThan(valueAt(gentle, 'width', 89) as number);
  });

  it('clamps intensity to a usable range', () => {
    // A zero or negative intensity would emit a move that does nothing.
    expect(valueAt(build('zoom-in', { intensity: 0 }), 'width', 89)).toBeGreaterThan(1920);
    expect(valueAt(build('zoom-in', { intensity: -1 }), 'width', 89)).toBeGreaterThan(1920);
    expect(valueAt(build('zoom-in', { intensity: 99 }), 'width', 89)).toBeCloseTo(1920 * 2);
  });

  it('applies the move relative to an off-centre item', () => {
    const offset = { ...base, x: 200, y: -50 };
    const kfs = build('pan-left', { base: offset });
    const travel = (1920 * 1.15 - 1920) / 2;
    expect(valueAt(kfs, 'x', 0)).toBeCloseTo(200 - travel);
    expect(valueAt(kfs, 'x', 89)).toBeCloseTo(200 + travel);
  });

  it('carries the chosen easing onto every keyframe', () => {
    const kfs = build('ken-burns', { easing: 'linear' });
    expect(kfs.every((k) => k.easing === 'linear')).toBe(true);
  });

  it('tags every keyframe with the target item', () => {
    expect(build('zoom-in', { itemId: 'abc' }).every((k) => k.itemId === 'abc')).toBe(true);
  });
});

describe('getMotionPresetProperties', () => {
  it('reports exactly the properties each preset writes', () => {
    for (const preset of MOTION_PRESETS) {
      const written = new Set(build(preset.id).map((k) => k.property));
      const declared = new Set(getMotionPresetProperties(preset.id));
      expect(declared).toEqual(written);
    }
  });
});
