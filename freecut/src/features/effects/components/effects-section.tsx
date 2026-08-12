import { useCallback, useMemo, memo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Plus, Eye, EyeOff, Search, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/shared/ui/cn';
import type { TimelineItem } from '@/types/timeline';
import type { ItemEffect, GpuEffect } from '@/types/effects';
import { EFFECT_PRESETS } from '@/types/effects';
import { useTimelineStore } from '@/features/effects/deps/timeline-contract';
import { useGizmoStore } from '@/features/effects/deps/preview-contract';
import { PropertySection } from '@/shared/ui/property-controls';
import { GpuEffectPanel, GpuWheelsPanel, GpuCurvesPanel } from './panels';
import { getGpuCategoriesWithEffects, getGpuEffect, getGpuEffectDefaultParams, EffectsPipeline, getGpuOnlyEffectTypes, hasCssEquivalent } from '@/infrastructure/gpu/effects';
import { useEffectPreviews } from '../hooks/use-effect-previews';

interface EffectsSectionProps {
  /** Visual items (already filtered to exclude audio) */
  items: TimelineItem[];
}

/**
 * Effects section - GPU shader effects for visual items.
 * Only shown when selection includes video, image, text, or shape clips.
 * Memoized to prevent re-renders when items prop hasn't changed.
 */
export const EffectsSection = memo(function EffectsSection({ items }: EffectsSectionProps) {
  const addEffect = useTimelineStore((s) => s.addEffect);
  const addEffects = useTimelineStore((s) => s.addEffects);
  const updateEffect = useTimelineStore((s) => s.updateEffect);
  const removeEffect = useTimelineStore((s) => s.removeEffect);
  const toggleEffect = useTimelineStore((s) => s.toggleEffect);

  // Gizmo store for live effect preview
  const setEffectsPreviewNew = useGizmoStore((s) => s.setEffectsPreviewNew);
  const clearPreview = useGizmoStore((s) => s.clearPreview);

  // Items are already filtered by parent - use directly
  const visualItems = items;

  // Probe the GPU device once so the panel can tell the user when effects
  // cannot possibly render. The device request is cached (including failures),
  // so this costs nothing after the first call.
  const [gpuUnavailable, setGpuUnavailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void EffectsPipeline.requestCachedDevice().then((device) => {
      if (!cancelled) setGpuUnavailable(!device);
    });
    return () => { cancelled = true; };
  }, []);

  // Memoize item IDs for stable callback dependencies
  const itemIds = useMemo(() => visualItems.map((item) => item.id), [visualItems]);

  // Get effects from first selected item (for display)
  // Multi-select shows first item's effects
  const effects: ItemEffect[] = visualItems[0]?.effects ?? [];

  // Name the effects on this clip that cannot render without a GPU, so the
  // warning points at the actual culprit instead of leaving the user to guess
  // which of their effects is the inert one.
  const inactiveEffectNames = useMemo(() => {
    if (!gpuUnavailable) return [];
    return getGpuOnlyEffectTypes(effects)
      .map((type) => getGpuEffect(type)?.name ?? type);
  }, [gpuUnavailable, effects]);

  // Add a GPU shader effect
  const handleAddGpuEffect = useCallback(
    (gpuEffectId: string) => {
      const defaults = getGpuEffectDefaultParams(gpuEffectId);
      itemIds.forEach((id) => {
        addEffect(id, {
          type: 'gpu-effect',
          gpuEffectType: gpuEffectId,
          params: defaults,
        } as GpuEffect);
      });
    },
    [itemIds, addEffect]
  );

  // GPU effect categories for dropdown menu
  const gpuCategories = useMemo(() => getGpuCategoriesWithEffects(), []);

  // Effect preview thumbnails — lazily GPU-rendered on first dropdown open
  const allEffectEntries = useMemo(
    () => gpuCategories.flatMap(({ effects: catEffects }) =>
      catEffects.map((def) => ({ id: def.id, def }))
    ),
    [gpuCategories],
  );
  const presetIds = useMemo(() => EFFECT_PRESETS.map((p) => p.id), []);
  const { previews: effectPreviews, trigger: triggerPreviews } = useEffectPreviews(allEffectEntries, presetIds);

  // Update GPU effect parameter(s)
  const handleGpuParamChange = useCallback(
    (effectId: string, paramKey: string, value: number | boolean | string) => {
      const effect = effects.find((e) => e.id === effectId);
      if (!effect || effect.effect.type !== 'gpu-effect') return;

      const gpuEff = effect.effect as GpuEffect;
      itemIds.forEach((id) => {
        updateEffect(id, effectId, {
          effect: {
            ...gpuEff,
            params: { ...gpuEff.params, [paramKey]: value },
          },
        });
      });
      queueMicrotask(() => clearPreview());
    },
    [effects, itemIds, updateEffect, clearPreview]
  );

  // Batch update multiple GPU effect params atomically
  const handleGpuParamsBatchChange = useCallback(
    (effectId: string, updates: Record<string, number | boolean | string>) => {
      const effect = effects.find((e) => e.id === effectId);
      if (!effect || effect.effect.type !== 'gpu-effect') return;

      const gpuEff = effect.effect as GpuEffect;
      itemIds.forEach((id) => {
        updateEffect(id, effectId, {
          effect: {
            ...gpuEff,
            params: { ...gpuEff.params, ...updates },
          },
        });
      });
      queueMicrotask(() => clearPreview());
    },
    [effects, itemIds, updateEffect, clearPreview]
  );

  // Live preview for GPU effect parameter
  const handleGpuParamLiveChange = useCallback(
    (effectId: string, paramKey: string, value: number | boolean | string) => {
      const effect = effects.find((e) => e.id === effectId);
      if (!effect || effect.effect.type !== 'gpu-effect') return;

      const previews: Record<string, ItemEffect[]> = {};
      itemIds.forEach((id) => {
        const item = visualItems.find((i) => i.id === id);
        if (!item) return;
        previews[id] = (item.effects ?? []).map((entry) => {
          if (entry.id !== effectId || entry.effect.type !== 'gpu-effect') return entry;
          const entryGpu = entry.effect as GpuEffect;
          return {
            ...entry,
            effect: {
              ...entryGpu,
              params: { ...entryGpu.params, [paramKey]: value },
            },
          };
        });
      });
      setEffectsPreviewNew(previews);
    },
    [effects, itemIds, visualItems, setEffectsPreviewNew]
  );

  // Batch live preview for multiple GPU effect params atomically
  const handleGpuParamsBatchLiveChange = useCallback(
    (effectId: string, updates: Record<string, number | boolean | string>) => {
      const effect = effects.find((e) => e.id === effectId);
      if (!effect || effect.effect.type !== 'gpu-effect') return;

      const previews: Record<string, ItemEffect[]> = {};
      itemIds.forEach((id) => {
        const item = visualItems.find((i) => i.id === id);
        if (!item) return;
        previews[id] = (item.effects ?? []).map((entry) => {
          if (entry.id !== effectId || entry.effect.type !== 'gpu-effect') return entry;
          const entryGpu = entry.effect as GpuEffect;
          return {
            ...entry,
            effect: {
              ...entryGpu,
              params: { ...entryGpu.params, ...updates },
            },
          };
        });
      });
      setEffectsPreviewNew(previews);
    },
    [effects, itemIds, visualItems, setEffectsPreviewNew]
  );

  // Reset GPU effect to defaults
  const handleResetGpuEffect = useCallback(
    (effectId: string) => {
      const effect = effects.find((e) => e.id === effectId);
      if (!effect || effect.effect.type !== 'gpu-effect') return;

      const gpuEff = effect.effect as GpuEffect;
      const defaults = getGpuEffectDefaultParams(gpuEff.gpuEffectType);
      itemIds.forEach((id) => {
        updateEffect(id, effectId, {
          effect: { ...gpuEff, params: defaults },
        });
      });
    },
    [effects, itemIds, updateEffect]
  );

  // Apply a preset (adds multiple GPU effects as single undo/redo action)
  const handleApplyPreset = useCallback(
    (presetId: string) => {
      const preset = EFFECT_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;

      // Batch all effects for all items into a single store update
      const updates = itemIds.map((id) => ({
        itemId: id,
        effects: preset.effects,
      }));
      addEffects(updates);
    },
    [itemIds, addEffects]
  );

  // Toggle effect visibility
  const handleToggle = useCallback(
    (effectId: string) => {
      itemIds.forEach((id) => toggleEffect(id, effectId));
    },
    [itemIds, toggleEffect]
  );

  // Check if all effects are enabled
  const allEffectsEnabled = useMemo(
    () => effects.length > 0 && effects.every((e) => e.enabled),
    [effects]
  );

  // Toggle all effects on/off
  const handleToggleAll = useCallback(() => {
    const newEnabled = !allEffectsEnabled;
    itemIds.forEach((id) => {
      effects.forEach((effect) => {
        // Only toggle if current state differs from target
        if (effect.enabled !== newEnabled) {
          toggleEffect(id, effect.id);
        }
      });
    });
  }, [itemIds, effects, allEffectsEnabled, toggleEffect]);

  // Remove effect
  const handleRemove = useCallback(
    (effectId: string) => {
      itemIds.forEach((id) => removeEffect(id, effectId));
    },
    [itemIds, removeEffect]
  );

  // Effect picker popover state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Position the picker panel below the trigger button
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const openPicker = useCallback(() => {
    triggerPreviews();
    setSearchQuery('');
    setPickerOpen(true);
  }, [triggerPreviews]);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setSearchQuery('');
    triggerRef.current?.blur();
  }, []);

  // Position panel when opened
  useEffect(() => {
    if (!pickerOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPanelStyle({
      position: 'fixed',
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
    });
    // Focus search input after render
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [pickerOpen]);

  // Close on click outside
  useEffect(() => {
    if (!pickerOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (
        panelRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      ) return;
      closePicker();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePicker();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [pickerOpen, closePicker]);

  // Filter effects and presets by search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return gpuCategories;
    const q = searchQuery.toLowerCase();
    return gpuCategories
      .map(({ category, effects: catEffects }) => ({
        category,
        effects: catEffects.filter((def) => def.name.toLowerCase().includes(q)),
      }))
      .filter(({ effects: catEffects }) => catEffects.length > 0);
  }, [gpuCategories, searchQuery]);

  const filteredPresets = useMemo(() => {
    if (!searchQuery.trim()) return EFFECT_PRESETS;
    const q = searchQuery.toLowerCase();
    return EFFECT_PRESETS.filter((p) => p.name.toLowerCase().includes(q));
  }, [searchQuery]);

  const hasResults = filteredCategories.length > 0 || filteredPresets.length > 0;

  if (visualItems.length === 0) return null;

  return (
    <PropertySection title="Effects" icon={Sparkles} defaultOpen={true}>
      {/* Every effect in this panel is a WebGPU shader. Without a device they
          are added to the clip and then silently skipped at render time, which
          reads as "the app is broken" — so say what is actually wrong. */}
      {gpuUnavailable && (
        <div className="mx-2 mb-2 px-2 py-2 flex items-start gap-2 text-xs rounded border border-amber-500/30 bg-amber-500/10 text-amber-200">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span className="leading-relaxed">
            WebGPU is unavailable in this browser. Colour and blur effects still
            render through CSS
            {inactiveEffectNames.length > 0 && (
              <>
                , but{' '}
                <span className="font-semibold">{inactiveEffectNames.join(', ')}</span>
                {inactiveEffectNames.length === 1 ? ' is' : ' are'} inactive on this clip
              </>
            )}
            . Open <span className="font-mono">chrome://gpu</span> and enable hardware
            acceleration, then restart the browser to get the full set.
          </span>
        </div>
      )}

      {/* Add Effect Picker + Toggle All */}
      <div className="px-2 pb-2 flex gap-1">
        <Button
          ref={triggerRef}
          variant="outline"
          size="sm"
          className="flex-1 h-7 text-xs"
          onClick={() => pickerOpen ? closePicker() : openPicker()}
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Effect
        </Button>
        {pickerOpen && createPortal(
          <div
            ref={panelRef}
            style={panelStyle}
            className="z-50 rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 slide-in-from-top-2"
          >
            {/* Search input */}
            <div className="p-1.5 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search effects..."
                  className="w-full h-7 pl-7 pr-2 text-xs bg-transparent rounded-sm border border-input placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>

            {/* Scrollable effect list */}
            <div className="max-h-[280px] overflow-y-auto overflow-x-hidden p-1">
              {/* GPU Shader Effects */}
              {filteredCategories.map(({ category, effects: catEffects }, index) => (
                <div key={category}>
                  {index > 0 && <div className="-mx-1 my-1 h-px bg-muted" />}
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </div>
                  {catEffects.map((def) => {
                    // Without a GPU device only the CSS-equivalent effects
                    // render. Marking them here answers "which of these
                    // actually work?" before the click, instead of leaving the
                    // user to discover it by seeing nothing happen.
                    const inert = gpuUnavailable && !hasCssEquivalent(def.id);
                    return (
                      <button
                        key={def.id}
                        type="button"
                        disabled={inert}
                        className={cn(
                          'relative flex w-full select-none items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-none',
                          inert
                            ? 'cursor-not-allowed opacity-40'
                            : 'cursor-default hover:bg-accent hover:text-accent-foreground',
                        )}
                        title={inert ? 'Needs WebGPU — unavailable in this browser' : undefined}
                        onClick={() => {
                          handleAddGpuEffect(def.id);
                          closePicker();
                        }}
                      >
                        {effectPreviews.has(def.id) ? (
                          <img
                            src={effectPreviews.get(def.id)}
                            alt=""
                            className="w-8 h-[18px] rounded-sm object-cover flex-shrink-0"
                          />
                        ) : (
                          <span className="w-8 h-[18px] rounded-sm bg-muted flex-shrink-0" />
                        )}
                        <span className="flex-1 text-left">{def.name}</span>
                        {inert && (
                          <span className="text-[9px] font-semibold tracking-wide text-muted-foreground">
                            GPU
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}

              {filteredPresets.length > 0 && (
                <>
                  {filteredCategories.length > 0 && <div className="-mx-1 my-1 h-px bg-muted" />}
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    Presets
                  </div>
                  {filteredPresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-accent hover:text-accent-foreground"
                      onClick={() => {
                        handleApplyPreset(preset.id);
                        closePicker();
                      }}
                    >
                      {effectPreviews.has(`preset:${preset.id}`) ? (
                        <img
                          src={effectPreviews.get(`preset:${preset.id}`)}
                          alt=""
                          className="w-8 h-[18px] rounded-sm object-cover flex-shrink-0"
                        />
                      ) : (
                        <span className="w-8 h-[18px] rounded-sm bg-muted flex-shrink-0" />
                      )}
                      {preset.name}
                    </button>
                  ))}
                </>
              )}

              {/* No results */}
              {!hasResults && (
                <div className="px-2 py-4 text-xs text-muted-foreground text-center">
                  No effects found
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
        {effects.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2"
            onClick={handleToggleAll}
            title={allEffectsEnabled ? 'Disable all effects' : 'Enable all effects'}
          >
            {allEffectsEnabled ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </Button>
        )}
      </div>

      {/* Active Effects List - wrapped to prevent space-y-3 from PropertySection */}
      <div className="space-y-0">
      {effects.map((effect) => {
        if (effect.effect.type === 'gpu-effect') {
          const gpuEff = effect.effect as GpuEffect;
          const def = getGpuEffect(gpuEff.gpuEffectType);
          if (!def) return null;

          if (gpuEff.gpuEffectType === 'gpu-curves') {
            return (
              <GpuCurvesPanel
                key={effect.id}
                effect={effect}
                gpuEffect={gpuEff}
                definition={def}
                onParamChange={handleGpuParamChange}
                onParamLiveChange={handleGpuParamLiveChange}
                onReset={handleResetGpuEffect}
                onToggle={handleToggle}
                onRemove={handleRemove}
              />
            );
          }

          if (gpuEff.gpuEffectType === 'gpu-color-wheels') {
            return (
              <GpuWheelsPanel
                key={effect.id}
                effect={effect}
                gpuEffect={gpuEff}
                definition={def}
                onParamChange={handleGpuParamChange}
                onParamLiveChange={handleGpuParamLiveChange}
                onParamsBatchChange={handleGpuParamsBatchChange}
                onParamsBatchLiveChange={handleGpuParamsBatchLiveChange}
                onReset={handleResetGpuEffect}
                onToggle={handleToggle}
                onRemove={handleRemove}
              />
            );
          }

          return (
            <GpuEffectPanel
              key={effect.id}
              effect={effect}
              gpuEffect={gpuEff}
              definition={def}
              onParamChange={handleGpuParamChange}
              onParamLiveChange={handleGpuParamLiveChange}
              onReset={handleResetGpuEffect}
              onToggle={handleToggle}
              onRemove={handleRemove}
            />
          );
        }

        return null;
      })}
      </div>

      {/* Empty state */}
      {effects.length === 0 && (
        <div className="px-2 py-3 text-xs text-muted-foreground text-center">
          No effects applied. Click "Add Effect" to get started.
        </div>
      )}
    </PropertySection>
  );
});
