import { useCallback, useMemo, useState, memo } from 'react';
import { Film, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PropertySection, SliderInput } from '@/shared/ui/property-controls';
import type { TimelineItem } from '@/types/timeline';
import type { EasingType } from '@/types/keyframe';
import type { ResolvedTransform } from '@/types/transform';
import { useTimelineStore } from '@/features/keyframes/deps/timeline-contract';
import {
  MOTION_PRESETS,
  buildMotionPresetKeyframes,
  getMotionPresetProperties,
  DEFAULT_MOTION_INTENSITY,
  DEFAULT_MOTION_EASING,
  type MotionPresetId,
} from '../utils/motion-presets';

interface AnimationSectionProps {
  /** Visual items currently selected (audio is filtered out by the parent). */
  items: TimelineItem[];
  /** Canvas size, used as the fallback frame when an item has no explicit transform. */
  canvas: { width: number; height: number };
}

const EASING_CHOICES: Array<{ value: EasingType; label: string }> = [
  { value: 'ease-in-out', label: 'Smooth' },
  { value: 'linear', label: 'Constant' },
  { value: 'ease-out', label: 'Settle' },
  { value: 'ease-in', label: 'Build' },
];

/**
 * Camera moves — pan, zoom, Ken Burns — applied as keyframes.
 *
 * Deliberately built on the keyframe system rather than as an effect: these
 * are transforms over time, so they need no GPU (they work where WebGPU is
 * unavailable) and the result stays editable in the keyframe editor instead of
 * being a black box the user cannot adjust.
 */
export const AnimationSection = memo(function AnimationSection({ items, canvas }: AnimationSectionProps) {
  const addKeyframes = useTimelineStore((s) => s.addKeyframes);
  const removeKeyframesForProperty = useTimelineStore((s) => s.removeKeyframesForProperty);
  const removeKeyframesForItem = useTimelineStore((s) => s.removeKeyframesForItem);

  const [intensity, setIntensity] = useState(DEFAULT_MOTION_INTENSITY);
  const [easing, setEasing] = useState<EasingType>(DEFAULT_MOTION_EASING);

  const itemIds = useMemo(() => items.map((item) => item.id), [items]);

  /**
   * The transform a move is applied relative to. Items only store the fields
   * the user has changed, so anything unset falls back to "fills the canvas,
   * centred" — the same defaults the renderer assumes.
   */
  const resolveBase = useCallback((item: TimelineItem): ResolvedTransform => {
    const transform = item.transform ?? {};
    return {
      x: transform.x ?? 0,
      y: transform.y ?? 0,
      width: transform.width ?? canvas.width,
      height: transform.height ?? canvas.height,
      rotation: transform.rotation ?? 0,
      opacity: transform.opacity ?? 1,
      cornerRadius: transform.cornerRadius ?? 0,
    };
  }, [canvas.width, canvas.height]);

  const applyPreset = useCallback((preset: MotionPresetId) => {
    const payloads = items.flatMap((item) => {
      // Replace rather than stack: applying two moves to the same property
      // would leave interleaved keyframes and a motion nobody asked for.
      for (const property of getMotionPresetProperties(preset)) {
        removeKeyframesForProperty(item.id, property);
      }

      return buildMotionPresetKeyframes({
        preset,
        itemId: item.id,
        durationInFrames: item.durationInFrames,
        base: resolveBase(item),
        intensity,
        easing,
      });
    });

    if (payloads.length > 0) addKeyframes(payloads);
  }, [items, intensity, easing, resolveBase, addKeyframes, removeKeyframesForProperty]);

  const clearAll = useCallback(() => {
    itemIds.forEach((id) => removeKeyframesForItem(id));
  }, [itemIds, removeKeyframesForItem]);

  if (items.length === 0) return null;

  // A single-frame clip has no span to animate across.
  const tooShort = items.every((item) => item.durationInFrames < 2);

  return (
    <PropertySection title="Animation" icon={Film} defaultOpen={false}>
      <div className="px-2 pb-2 space-y-3">
        {tooShort ? (
          <p className="text-xs text-muted-foreground">
            This clip is too short to animate — it needs at least two frames.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-1">
              {MOTION_PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  variant="outline"
                  size="sm"
                  className="h-auto py-1.5 text-[11px] leading-tight"
                  title={preset.description}
                  onClick={() => applyPreset(preset.id)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            <SliderInput
              label="Strength"
              value={intensity}
              onChange={setIntensity}
              min={0.02}
              max={0.6}
              step={0.01}
              formatValue={(v) => `${Math.round(v * 100)}%`}
            />

            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">Pacing</span>
              <div className="grid grid-cols-4 gap-1">
                {EASING_CHOICES.map((choice) => (
                  <Button
                    key={choice.value}
                    variant={easing === choice.value ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => setEasing(choice.value)}
                  >
                    {choice.label}
                  </Button>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Applying a move writes keyframes you can then edit by hand. Strength
              and pacing apply to the next move, not to one already added.
            </p>

            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-[11px] text-muted-foreground"
              onClick={clearAll}
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Clear animation
            </Button>
          </>
        )}
      </div>
    </PropertySection>
  );
});
