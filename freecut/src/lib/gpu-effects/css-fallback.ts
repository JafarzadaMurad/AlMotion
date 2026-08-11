import type { ItemEffect } from '@/types/effects';

/**
 * CSS-filter fallback for GPU effects.
 *
 * Every effect in the app is a WebGPU shader. On a machine with no usable GPU
 * adapter the shader pipeline never initializes and each effect is silently
 * skipped, so the clip looks untouched. A subset of the colour and blur
 * effects have exact native CSS equivalents that need no GPU at all, so we
 * render those through `filter:` instead of dropping them.
 *
 * This is deliberately a strict subset. Effects with no faithful CSS analogue
 * (curves, chroma key, kaleidoscope, halftone, …) are left to the GPU path;
 * approximating them here would misrepresent what the export will produce.
 */

/** GPU effect ids that this module can reproduce with a CSS filter function. */
const CSS_EQUIVALENT_EFFECTS = new Set([
  'gpu-brightness',
  'gpu-contrast',
  'gpu-saturation',
  'gpu-grayscale',
  'gpu-sepia',
  'gpu-invert',
  'gpu-hue-shift',
  'gpu-exposure',
  'gpu-gaussian-blur',
  'gpu-box-blur',
]);

/** True when this effect can be rendered without a GPU device. */
export function hasCssEquivalent(gpuEffectType: string): boolean {
  return CSS_EQUIVALENT_EFFECTS.has(gpuEffectType);
}

function num(params: Record<string, unknown> | undefined, key: string, fallback: number): number {
  const value = params?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Translate one GPU effect into a CSS filter function, or null when the effect
 * has no faithful CSS equivalent.
 *
 * Parameter ranges mirror the shader definitions in `@/lib/gpu-effects`:
 * - brightness `amount` is additive in −1..1; CSS `brightness()` is
 *   multiplicative around 1, so shift it into 0..2.
 * - contrast / saturation `amount` are already multipliers in 0..3.
 * - hue-shift `shift` is a 0..1 turn; CSS wants degrees.
 * - blur `radius` is in source pixels, which is what `blur()` takes.
 */
function toCssFilterFunction(gpuEffectType: string, params: Record<string, unknown> | undefined): string | null {
  switch (gpuEffectType) {
    case 'gpu-brightness':
      return `brightness(${(1 + num(params, 'amount', 0)).toFixed(4)})`;
    case 'gpu-contrast':
      return `contrast(${num(params, 'amount', 1).toFixed(4)})`;
    case 'gpu-saturation':
      return `saturate(${num(params, 'amount', 1).toFixed(4)})`;
    case 'gpu-grayscale':
      return `grayscale(${num(params, 'amount', 1).toFixed(4)})`;
    case 'gpu-sepia':
      return `sepia(${num(params, 'amount', 1).toFixed(4)})`;
    case 'gpu-invert':
      // The invert shader takes no parameters — it is always a full inversion.
      return 'invert(1)';
    case 'gpu-hue-shift':
      return `hue-rotate(${(num(params, 'shift', 0) * 360).toFixed(2)}deg)`;
    case 'gpu-exposure': {
      // The shader is `rgb * 2^EV`, then an additive offset, then a gamma
      // curve. Only the first term has a CSS equivalent, so hand the effect
      // back to the GPU path whenever offset or gamma leave their neutral
      // values — a partial render would be worse than none.
      if (num(params, 'offset', 0) !== 0 || num(params, 'gamma', 1) !== 1) return null;
      return `brightness(${Math.pow(2, num(params, 'exposure', 0)).toFixed(4)})`;
    }
    case 'gpu-gaussian-blur':
    case 'gpu-box-blur':
      return `blur(${num(params, 'radius', 5).toFixed(2)}px)`;
    default:
      return null;
  }
}

/**
 * Build a CSS `filter` value for the effects that can be rendered without a
 * GPU. Returns an empty string when nothing applies, which callers should
 * treat as "leave the filter property unset".
 *
 * Order is preserved: CSS filter functions compose left to right, the same way
 * the GPU pipeline chains its passes, so a brightness→blur stack looks the
 * same in both paths.
 */
export function buildCssEffectFilter(effects: ItemEffect[] | undefined): string {
  if (!effects || effects.length === 0) return '';

  const functions: string[] = [];
  for (const entry of effects) {
    if (!entry.enabled) continue;
    if (entry.effect.type !== 'gpu-effect') continue;

    const cssFunction = toCssFilterFunction(
      entry.effect.gpuEffectType,
      entry.effect.params as Record<string, unknown> | undefined,
    );
    if (cssFunction) functions.push(cssFunction);
  }

  return functions.join(' ');
}

/**
 * Effects that were asked for but cannot be shown without a GPU. Useful for
 * telling the user which of their effects are inert rather than letting them
 * wonder why only some of the stack took hold.
 */
export function getGpuOnlyEffectTypes(effects: ItemEffect[] | undefined): string[] {
  if (!effects) return [];
  return effects
    .filter((entry) => entry.enabled && entry.effect.type === 'gpu-effect')
    .map((entry) => entry.effect.gpuEffectType)
    .filter((type) => !hasCssEquivalent(type));
}
