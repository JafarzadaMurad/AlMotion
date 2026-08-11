import { describe, it, expect } from 'vitest';
import type { ItemEffect } from '@/types/effects';
import { buildCssEffectFilter, getGpuOnlyEffectTypes, hasCssEquivalent } from './css-fallback';

function gpuEffect(gpuEffectType: string, params: Record<string, unknown> = {}, enabled = true): ItemEffect {
  return {
    id: `id-${gpuEffectType}`,
    enabled,
    effect: { type: 'gpu-effect', gpuEffectType, params },
  } as ItemEffect;
}

describe('buildCssEffectFilter', () => {
  it('returns an empty string when there is nothing to apply', () => {
    expect(buildCssEffectFilter(undefined)).toBe('');
    expect(buildCssEffectFilter([])).toBe('');
  });

  it('shifts additive brightness into the multiplicative CSS range', () => {
    // Shader amount is -1..1 additive; CSS brightness() is a multiplier at 1.
    expect(buildCssEffectFilter([gpuEffect('gpu-brightness', { amount: 0.25 })]))
      .toBe('brightness(1.2500)');
    expect(buildCssEffectFilter([gpuEffect('gpu-brightness', { amount: -0.5 })]))
      .toBe('brightness(0.5000)');
  });

  it('converts a hue shift turn into degrees', () => {
    expect(buildCssEffectFilter([gpuEffect('gpu-hue-shift', { shift: 0.5 })]))
      .toBe('hue-rotate(180.00deg)');
  });

  it('passes multiplier-style params straight through', () => {
    expect(buildCssEffectFilter([gpuEffect('gpu-contrast', { amount: 1.4 })]))
      .toBe('contrast(1.4000)');
    expect(buildCssEffectFilter([gpuEffect('gpu-saturation', { amount: 0 })]))
      .toBe('saturate(0.0000)');
  });

  it('converts neutral-curve exposure into a brightness multiplier', () => {
    // Shader is rgb * 2^EV, so +1 EV doubles and -1 EV halves.
    expect(buildCssEffectFilter([gpuEffect('gpu-exposure', { exposure: 1, offset: 0, gamma: 1 })]))
      .toBe('brightness(2.0000)');
    expect(buildCssEffectFilter([gpuEffect('gpu-exposure', { exposure: -1, offset: 0, gamma: 1 })]))
      .toBe('brightness(0.5000)');
  });

  it('leaves exposure to the GPU when offset or gamma are not neutral', () => {
    // Those terms have no CSS analogue, so a partial render would be wrong.
    expect(buildCssEffectFilter([gpuEffect('gpu-exposure', { exposure: 1, offset: 0.2, gamma: 1 })]))
      .toBe('');
    expect(buildCssEffectFilter([gpuEffect('gpu-exposure', { exposure: 1, offset: 0, gamma: 2.2 })]))
      .toBe('');
  });

  it('treats invert as parameterless, matching the shader', () => {
    expect(buildCssEffectFilter([gpuEffect('gpu-invert')])).toBe('invert(1)');
  });

  it('maps both blur variants to blur() in pixels', () => {
    expect(buildCssEffectFilter([gpuEffect('gpu-gaussian-blur', { radius: 8 })]))
      .toBe('blur(8.00px)');
    expect(buildCssEffectFilter([gpuEffect('gpu-box-blur', { radius: 3 })]))
      .toBe('blur(3.00px)');
  });

  it('falls back to the shader default when a param is missing or invalid', () => {
    expect(buildCssEffectFilter([gpuEffect('gpu-saturation')])).toBe('saturate(1.0000)');
    expect(buildCssEffectFilter([gpuEffect('gpu-gaussian-blur', { radius: Number.NaN })]))
      .toBe('blur(5.00px)');
  });

  it('preserves stack order so composition matches the GPU pass chain', () => {
    const filter = buildCssEffectFilter([
      gpuEffect('gpu-brightness', { amount: 0 }),
      gpuEffect('gpu-gaussian-blur', { radius: 2 }),
    ]);
    expect(filter).toBe('brightness(1.0000) blur(2.00px)');
  });

  it('skips disabled effects', () => {
    expect(buildCssEffectFilter([gpuEffect('gpu-sepia', { amount: 1 }, false)])).toBe('');
  });

  it('omits effects that have no faithful CSS equivalent', () => {
    const filter = buildCssEffectFilter([
      gpuEffect('gpu-kaleidoscope', { segments: 6 }),
      gpuEffect('gpu-grayscale', { amount: 1 }),
    ]);
    expect(filter).toBe('grayscale(1.0000)');
  });
});

describe('hasCssEquivalent', () => {
  it('accepts the colour and blur subset and rejects the rest', () => {
    expect(hasCssEquivalent('gpu-sepia')).toBe(true);
    expect(hasCssEquivalent('gpu-box-blur')).toBe(true);
    expect(hasCssEquivalent('gpu-chroma-key')).toBe(false);
    expect(hasCssEquivalent('gpu-curves')).toBe(false);
  });
});

describe('getGpuOnlyEffectTypes', () => {
  it('reports the enabled effects that cannot render without a GPU', () => {
    const types = getGpuOnlyEffectTypes([
      gpuEffect('gpu-grayscale', { amount: 1 }),
      gpuEffect('gpu-halftone', {}),
      gpuEffect('gpu-ascii', {}, false),
    ]);
    expect(types).toEqual(['gpu-halftone']);
  });
});
