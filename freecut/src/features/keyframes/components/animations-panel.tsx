import { useCallback, useMemo, useState, memo } from 'react';
import { Info, RotateCcw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SliderInput } from '@/shared/ui/property-controls';
import type { TimelineItem } from '@/types/timeline';
import type { EasingType } from '@/types/keyframe';
import type { ResolvedTransform } from '@/types/transform';
import { useTimelineStore } from '@/features/keyframes/deps/timeline-contract';
import { useSelectionStore } from '@/shared/state/selection';
import {
  MOTION_PRESETS,
  buildMotionPresetKeyframes,
  getMotionPresetProperties,
  DEFAULT_MOTION_INTENSITY,
  DEFAULT_MOTION_EASING,
  type MotionPresetId,
} from '@/shared/utils/motion-presets';

const EASING_CHOICES: Array<{ value: EasingType; label: string }> = [
  { value: 'ease-in-out', label: 'Smooth' },
  { value: 'linear', label: 'Constant' },
  { value: 'ease-out', label: 'Settle' },
  { value: 'ease-in', label: 'Build' },
];

/** Clips that can carry a camera move — audio has nothing to pan or zoom. */
function isAnimatable(item: TimelineItem): boolean {
  return item.type !== 'audio';
}

/**
 * Left-rail panel for camera moves.
 *
 * Lives beside Media and Transitions rather than in the properties sidebar
 * because it is a library you pick from, not a property of the current
 * selection — the same reason transitions live here.
 */
export const AnimationsPanel = memo(function AnimationsPanel() {
  const items = useTimelineStore((s) => s.items);
  const selectedItemIds = useSelectionStore((s) => s.selectedItemIds);
  const addKeyframes = useTimelineStore((s) => s.addKeyframes);
  const updateItem = useTimelineStore((s) => s.updateItem);
  const removeKeyframesForProperty = useTimelineStore((s) => s.removeKeyframesForProperty);
  const removeKeyframesForItem = useTimelineStore((s) => s.removeKeyframesForItem);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedItemIds.includes(item.id) && isAnimatable(item)),
    [items, selectedItemIds],
  );

  // The panel reflects the first selection, the way the effects panel does.
  const primary = selectedItems[0];
  const applied = primary?.motion;

  // Which preset's settings are open. Defaults to whatever the clip already
  // has, so selecting an animated clip shows its configuration rather than a
  // blank slate.
  const [openPreset, setOpenPreset] = useState<MotionPresetId | null>(null);
  const activePreset = (openPreset ?? applied?.preset ?? null) as MotionPresetId | null;

  const [draftIntensity, setDraftIntensity] = useState<number | null>(null);
  const [draftEasing, setDraftEasing] = useState<EasingType | null>(null);

  const intensity = draftIntensity ?? applied?.intensity ?? DEFAULT_MOTION_INTENSITY;
  const easing = (draftEasing ?? applied?.easing ?? DEFAULT_MOTION_EASING) as EasingType;

  const resolveBase = useCallback((item: TimelineItem): ResolvedTransform => {
    const transform = item.transform ?? {};
    return {
      x: transform.x ?? 0,
      y: transform.y ?? 0,
      // An item with no explicit size fills the frame; 1920x1080 matches the
      // renderer's own fallback so the move is computed against what is shown.
      width: transform.width ?? 1920,
      height: transform.height ?? 1080,
      rotation: transform.rotation ?? 0,
      opacity: transform.opacity ?? 1,
      cornerRadius: transform.cornerRadius ?? 0,
    };
  }, []);

  const apply = useCallback((preset: MotionPresetId, nextIntensity: number, nextEasing: EasingType) => {
    const payloads = selectedItems.flatMap((item) => {
      // Replace rather than stack: two moves on one property would interleave
      // keyframes into a motion nobody asked for.
      for (const property of getMotionPresetProperties(preset)) {
        removeKeyframesForProperty(item.id, property);
      }
      return buildMotionPresetKeyframes({
        preset,
        itemId: item.id,
        durationInFrames: item.durationInFrames,
        base: resolveBase(item),
        intensity: nextIntensity,
        easing: nextEasing,
      });
    });

    if (payloads.length === 0) return;

    addKeyframes(payloads);
    selectedItems.forEach((item) => {
      updateItem(item.id, { motion: { preset, intensity: nextIntensity, easing: nextEasing } });
    });
  }, [selectedItems, resolveBase, addKeyframes, updateItem, removeKeyframesForProperty]);

  const handlePresetClick = useCallback((preset: MotionPresetId) => {
    setOpenPreset(preset);
    // Reopening the applied preset should not silently re-apply with defaults.
    const nextIntensity = preset === applied?.preset ? intensity : DEFAULT_MOTION_INTENSITY;
    const nextEasing = preset === applied?.preset ? easing : DEFAULT_MOTION_EASING;
    setDraftIntensity(nextIntensity);
    setDraftEasing(nextEasing);
    apply(preset, nextIntensity, nextEasing);
  }, [apply, applied?.preset, intensity, easing]);

  const handleSettingChange = useCallback((next: { intensity?: number; easing?: EasingType }) => {
    if (!activePreset) return;
    const nextIntensity = next.intensity ?? intensity;
    const nextEasing = next.easing ?? easing;
    setDraftIntensity(nextIntensity);
    setDraftEasing(nextEasing);
    apply(activePreset, nextIntensity, nextEasing);
  }, [activePreset, intensity, easing, apply]);

  const clear = useCallback(() => {
    selectedItems.forEach((item) => {
      removeKeyframesForItem(item.id);
      updateItem(item.id, { motion: undefined });
    });
    setOpenPreset(null);
    setDraftIntensity(null);
    setDraftEasing(null);
  }, [selectedItems, removeKeyframesForItem, updateItem]);

  const tooShort = selectedItems.length > 0 && selectedItems.every((i) => i.durationInFrames < 2);

  return (
    <div className="h-full flex flex-col">
      {/* Status banner — mirrors the transitions panel so the rail reads consistently */}
      <div className="px-3 py-2 border-b border-border bg-secondary/30">
        <div className="flex items-start gap-2 text-xs">
          <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="text-muted-foreground leading-relaxed">
            {selectedItems.length === 0 ? (
              <span>Select a video, image, text or shape clip to animate it.</span>
            ) : tooShort ? (
              <span>This clip is too short to animate — it needs at least two frames.</span>
            ) : applied ? (
              <span className="text-primary">
                {MOTION_PRESETS.find((p) => p.id === applied.preset)?.label ?? applied.preset} is applied.
                Pick another to replace it.
              </span>
            ) : (
              <span>Pick a move to apply it to the selected clip.</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div className="grid grid-cols-2 gap-1.5">
          {MOTION_PRESETS.map((preset) => {
            const isApplied = applied?.preset === preset.id;
            return (
              <Button
                key={preset.id}
                variant={isApplied ? 'default' : 'outline'}
                size="sm"
                disabled={selectedItems.length === 0 || tooShort}
                className="h-auto py-2 text-[11px] leading-tight justify-start gap-1.5"
                title={preset.description}
                onClick={() => handlePresetClick(preset.id)}
              >
                {isApplied && <Check className="w-3 h-3 flex-shrink-0" />}
                {preset.label}
              </Button>
            );
          })}
        </div>

        {/* Settings for the selected move, revealed under the grid */}
        {activePreset && selectedItems.length > 0 && !tooShort && (
          <div className="pt-3 border-t border-border space-y-3">
            <div className="text-[11px] font-medium">
              {MOTION_PRESETS.find((p) => p.id === activePreset)?.label} settings
            </div>

            <SliderInput
              label="Strength"
              value={intensity}
              onChange={(value) => handleSettingChange({ intensity: value })}
              min={0.02}
              max={0.6}
              step={0.01}
              formatValue={(v) => `${Math.round(v * 100)}%`}
            />

            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">Pacing</span>
              <div className="grid grid-cols-2 gap-1">
                {EASING_CHOICES.map((choice) => (
                  <Button
                    key={choice.value}
                    variant={easing === choice.value ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => handleSettingChange({ easing: choice.value })}
                  >
                    {choice.label}
                  </Button>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              These write keyframes you can still edit by hand in the timeline.
            </p>

            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-[11px] text-muted-foreground"
              onClick={clear}
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Remove animation
            </Button>
          </div>
        )}
      </div>
    </div>
  );
});
