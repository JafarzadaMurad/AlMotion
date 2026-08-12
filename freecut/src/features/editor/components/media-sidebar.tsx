import { useCallback, useMemo, useRef, useEffect, memo, Activity, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Film,
  Layers,
  LineChart,
  Type,
  Square,
  Circle,
  Triangle,
  Star,
  Hexagon,
  Heart,
  Pentagon,
  Sparkles,
  MoveDiagonal,
  Blend,
  Pen,
  WandSparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEditorStore } from '@/shared/state/editor';
import { useTimelineStore } from '@/features/editor/deps/timeline-store';
import { usePlaybackStore } from '@/shared/state/playback';
import { useSelectionStore } from '@/shared/state/selection';
import { useProjectStore } from '@/features/editor/deps/projects';
import {
  clearMediaDragData,
  MediaLibrary,
  setMediaDragData,
} from '@/features/editor/deps/media-library';
import { KeyframeGraphPanel } from '@/features/editor/deps/timeline-ui';
import { TransitionsPanel } from './transitions-panel';
import { AnimationsPanel } from '@/features/editor/deps/keyframes-contract';
import {
  createDefaultAdjustmentItem,
  createDefaultShapeItem,
  createDefaultTextItem,
  findCompatibleTrackForItemType,
  findNearestAvailableSpace,
  getDefaultGeneratedLayerDurationInFrames,
} from '@/features/editor/deps/timeline-utils';
import type { TextItem, ShapeItem, ShapeType, AdjustmentItem } from '@/types/timeline';
import { useMaskEditorStore } from '@/features/editor/deps/preview';
import type { VisualEffect, GpuEffect } from '@/types/effects';
import { EFFECT_PRESETS } from '@/types/effects';
import { getGpuCategoriesWithEffects, getGpuEffectDefaultParams, EffectsPipeline, hasCssEquivalent } from '@/infrastructure/gpu/effects';
import { useEffectPreviews } from '@/features/editor/deps/effects-contract';
import { createLogger } from '@/shared/logging/logger';
import { useSettingsStore } from '@/features/editor/deps/settings';
import { AiPanel } from './ai-panel';
import {
  EDITOR_LAYOUT_CSS_VALUES,
  clampLeftEditorSidebarWidth,
  getEditorLayout,
} from '@/shared/ui/editor-layout';

const logger = createLogger('MediaSidebar');

export const MediaSidebar = memo(function MediaSidebar() {
  const editorDensity = useSettingsStore((s) => s.editorDensity);
  const editorLayout = getEditorLayout(editorDensity);
  // Use granular selectors - Zustand v5 best practice
  const leftSidebarOpen = useEditorStore((s) => s.leftSidebarOpen);
  const toggleLeftSidebar = useEditorStore((s) => s.toggleLeftSidebar);
  const mediaFullColumn = useEditorStore((s) => s.mediaFullColumn);
  const toggleMediaFullColumn = useEditorStore((s) => s.toggleMediaFullColumn);
  const keyframeEditorOpen = useEditorStore((s) => s.keyframeEditorOpen);
  const setKeyframeEditorOpen = useEditorStore((s) => s.setKeyframeEditorOpen);
  const toggleKeyframeEditorOpen = useEditorStore((s) => s.toggleKeyframeEditorOpen);
  const activeTab = useEditorStore((s) => s.activeTab);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const sidebarWidth = useEditorStore((s) => s.sidebarWidth);
  const setSidebarWidth = useEditorStore((s) => s.setSidebarWidth);

  // Auto-expand sidebar to 35% viewport when keyframe editor opens
  const prevKeyframeOpenRef = useRef(keyframeEditorOpen);
  const savedWidthBeforeExpandRef = useRef<number | null>(null);

  useEffect(() => {
    const wasOpen = prevKeyframeOpenRef.current;
    prevKeyframeOpenRef.current = keyframeEditorOpen;

    if (keyframeEditorOpen && !wasOpen) {
      const targetWidth = Math.floor(window.innerWidth * 0.35);
      const clamped = clampLeftEditorSidebarWidth(targetWidth, editorLayout);
      if (clamped > sidebarWidth) {
        savedWidthBeforeExpandRef.current = sidebarWidth;
        setSidebarWidth(clamped);
      }
    } else if (!keyframeEditorOpen && wasOpen && savedWidthBeforeExpandRef.current !== null) {
      setSidebarWidth(savedWidthBeforeExpandRef.current);
      savedWidthBeforeExpandRef.current = null;
    }
  }, [keyframeEditorOpen, editorLayout, sidebarWidth, setSidebarWidth]);

  // Resize handle logic
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const suppressGeneratedItemClickRef = useRef(false);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = e.clientX - startXRef.current;
      const newWidth = clampLeftEditorSidebarWidth(startWidthRef.current + delta, editorLayout);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      isResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [editorLayout, setSidebarWidth]);

  // NOTE: Don't subscribe to tracks, items, currentProject here!
  // These change frequently and would cause re-renders cascading to MediaLibrary/MediaCards
  // Read from store directly in callbacks using getState()

  // Add text item to timeline at the best available position
  const handleAddText = useCallback(() => {
    // Read all needed state from stores directly to avoid subscriptions
    const { tracks, items, fps, addItem } = useTimelineStore.getState();
    const { activeTrackId, selectItems } = useSelectionStore.getState();
    const currentProject = useProjectStore.getState().currentProject;

    const targetTrack = findCompatibleTrackForItemType({
      tracks,
      items,
      itemType: 'text',
      preferredTrackId: activeTrackId,
    });

    if (!targetTrack) {
      logger.warn('No available track for text item');
      return;
    }

    const durationInFrames = getDefaultGeneratedLayerDurationInFrames(fps);

    // Find the best position: start at playhead, find nearest available space
    const proposedPosition = usePlaybackStore.getState().currentFrame;
    const finalPosition = findNearestAvailableSpace(
      proposedPosition,
      durationInFrames,
      targetTrack.id,
      items
    ) ?? proposedPosition; // Fallback to proposed if no space found

    // Get canvas dimensions for initial transform
    const canvasWidth = currentProject?.metadata.width ?? 1920;
    const canvasHeight = currentProject?.metadata.height ?? 1080;

    const textItem: TextItem = createDefaultTextItem({
      trackId: targetTrack.id,
      from: finalPosition,
      durationInFrames,
      canvasWidth,
      canvasHeight,
    });

    addItem(textItem);
    // Select the new item
    selectItems([textItem.id]);
  }, []);

  // Add shape item to timeline at the best available position
  const handleAddShape = useCallback((shapeType: ShapeType) => {
    // Read all needed state from stores directly to avoid subscriptions
    const { tracks, items, fps, addItem } = useTimelineStore.getState();
    const { activeTrackId, selectItems } = useSelectionStore.getState();
    const currentProject = useProjectStore.getState().currentProject;

    const targetTrack = findCompatibleTrackForItemType({
      tracks,
      items,
      itemType: 'shape',
      preferredTrackId: activeTrackId,
    });

    if (!targetTrack) {
      logger.warn('No available track for shape item');
      return;
    }

    const durationInFrames = getDefaultGeneratedLayerDurationInFrames(fps);

    // Find the best position: start at playhead, find nearest available space
    const proposedPosition = usePlaybackStore.getState().currentFrame;
    const finalPosition = findNearestAvailableSpace(
      proposedPosition,
      durationInFrames,
      targetTrack.id,
      items
    ) ?? proposedPosition;

    const canvasWidth = currentProject?.metadata.width ?? 1920;
    const canvasHeight = currentProject?.metadata.height ?? 1080;

    const shapeItem: ShapeItem = createDefaultShapeItem({
      trackId: targetTrack.id,
      from: finalPosition,
      durationInFrames,
      canvasWidth,
      canvasHeight,
      shapeType,
    });

    addItem(shapeItem);
    // Select the new item
    selectItems([shapeItem.id]);
  }, []);

  // Add adjustment layer to timeline at the best available position
  // Optionally with pre-applied effects and custom label
  const handleAddAdjustmentLayer = useCallback((effects?: VisualEffect[], label?: string) => {
    // Read all needed state from stores directly to avoid subscriptions
    const { tracks, items, fps, addItem } = useTimelineStore.getState();
    const { activeTrackId, selectItems } = useSelectionStore.getState();

    const targetTrack = findCompatibleTrackForItemType({
      tracks,
      items,
      itemType: 'adjustment',
      preferredTrackId: activeTrackId,
    });

    if (!targetTrack) {
      logger.warn('No available track for adjustment layer');
      return;
    }

    const durationInFrames = getDefaultGeneratedLayerDurationInFrames(fps);

    // Find the best position: start at playhead, find nearest available space
    const proposedPosition = usePlaybackStore.getState().currentFrame;
    const finalPosition = findNearestAvailableSpace(
      proposedPosition,
      durationInFrames,
      targetTrack.id,
      items
    ) ?? proposedPosition;

    const adjustmentItem: AdjustmentItem = createDefaultAdjustmentItem({
      trackId: targetTrack.id,
      from: finalPosition,
      durationInFrames,
      effects,
      label,
    });

    addItem(adjustmentItem);
    // Select the new item
    selectItems([adjustmentItem.id]);
  }, []);

  // Create adjustment layer with preset effects
  const handleAddPreset = useCallback((presetId: string) => {
    const preset = EFFECT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    handleAddAdjustmentLayer(preset.effects, preset.name);
  }, [handleAddAdjustmentLayer]);

  // Add a single GPU effect — to selected clips, or as adjustment layer if nothing selected
  const handleAddGpuEffect = useCallback((gpuEffectId: string) => {
    const { selectedItemIds } = useSelectionStore.getState();
    const { items, addEffect } = useTimelineStore.getState();

    // Find selected visual items (not audio)
    const visualIds = selectedItemIds.filter((id) => {
      const item = items.find((i) => i.id === id);
      return item && item.type !== 'audio';
    });

    if (visualIds.length > 0) {
      const defaults = getGpuEffectDefaultParams(gpuEffectId);
      const effect: GpuEffect = {
        type: 'gpu-effect',
        gpuEffectType: gpuEffectId,
        params: defaults,
      };
      visualIds.forEach((id) => addEffect(id, effect));
    } else {
      // No visual selection — create adjustment layer with this effect
      const defaults = getGpuEffectDefaultParams(gpuEffectId);
      handleAddAdjustmentLayer(
        [{ type: 'gpu-effect', gpuEffectType: gpuEffectId, params: defaults }],
      );
    }
  }, [handleAddAdjustmentLayer]);

  // GPU effect categories and preview thumbnails (static data, memoize once)
  const gpuCategories = useMemo(() => getGpuCategoriesWithEffects(), []);

  // Without a WebGPU device most shaders are silently skipped at render time.
  // Marking them here means the browser answers "which of these work?" before
  // the user drags one onto a clip and sees nothing happen.
  const [gpuUnavailable, setGpuUnavailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void EffectsPipeline.requestCachedDevice().then((device) => {
      if (!cancelled) setGpuUnavailable(!device);
    });
    return () => { cancelled = true; };
  }, []);
  const allEffectEntries = useMemo(
    () => gpuCategories.flatMap(({ effects: catEffects }) =>
      catEffects.map((def) => ({ id: def.id, def }))
    ),
    [gpuCategories],
  );
  const presetIds = useMemo(() => EFFECT_PRESETS.map((p) => p.id), []);
  const { previews: effectPreviews, trigger: triggerPreviews } = useEffectPreviews(allEffectEntries, presetIds);

  // Category items for the vertical nav
  const categories = [
    { id: 'media' as const, icon: Film, label: 'Media' },
    { id: 'text' as const, icon: Type, label: 'Text' },
    { id: 'shapes' as const, icon: Pentagon, label: 'Shapes' },
    { id: 'effects' as const, icon: Layers, label: 'Effects' },
    { id: 'transitions' as const, icon: Blend, label: 'Transitions' },
    { id: 'animations' as const, icon: MoveDiagonal, label: 'Animations' },
    { id: 'ai' as const, icon: WandSparkles, label: 'AI' },
  ];

  const shouldSuppressGeneratedItemClick = useCallback(() => {
    if (!suppressGeneratedItemClickRef.current) {
      return false;
    }

    suppressGeneratedItemClickRef.current = false;
    return true;
  }, []);

  const handleTemplateDragStart = useCallback((payload: {
    itemType: 'text' | 'shape' | 'adjustment';
    label: string;
    shapeType?: ShapeType;
    effects?: VisualEffect[];
  }) => (event: React.DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.effectAllowed = 'copy';
    const dragData = {
      type: 'timeline-template' as const,
      ...payload,
    };

    suppressGeneratedItemClickRef.current = true;
    event.dataTransfer.setData('application/json', JSON.stringify(dragData));
    setMediaDragData(dragData);
  }, []);

  const handleTemplateDragEnd = useCallback(() => {
    clearMediaDragData();
    window.setTimeout(() => {
      suppressGeneratedItemClickRef.current = false;
    }, 0);
  }, []);

  return (
    <div className="flex h-full flex-shrink-0">
      {/* Vertical Category Bar */}
      <div
        className="panel-header border-r border-border flex flex-col items-center flex-shrink-0"
        style={{ width: EDITOR_LAYOUT_CSS_VALUES.sidebarRailWidth }}
      >
        {/* Header row - aligned with content panel header */}
        <div
          className="flex items-center justify-center border-b border-border w-full"
          style={{ height: EDITOR_LAYOUT_CSS_VALUES.sidebarHeaderHeight }}
        >
          <button
            onClick={toggleLeftSidebar}
            className="rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            style={{ width: EDITOR_LAYOUT_CSS_VALUES.sidebarHeaderButtonSize, height: EDITOR_LAYOUT_CSS_VALUES.sidebarHeaderButtonSize }}
            data-tooltip={leftSidebarOpen ? 'Collapse Panel' : 'Expand Panel'}
            data-tooltip-side="right"
          >
            {leftSidebarOpen ? (
              <ChevronLeft className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Category Icons */}
        <div className="flex flex-col gap-1 py-1.5">
          {categories.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => {
                if (activeTab === id && leftSidebarOpen) {
                  toggleLeftSidebar();
                } else {
                  setActiveTab(id);
                  if (!leftSidebarOpen) toggleLeftSidebar();
                  if (id === 'effects') triggerPreviews();
                }
              }}
              className={`
                w-9 h-9 rounded-lg flex items-center justify-center transition-all
                ${activeTab === id && leftSidebarOpen
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }
              `}
              data-tooltip={label}
              data-tooltip-side="right"
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}

          <div className="w-6 border-t border-border mx-auto my-0.5" />

          <button
            onClick={toggleKeyframeEditorOpen}
            className={`
              w-9 h-9 rounded-lg flex items-center justify-center transition-all
              ${keyframeEditorOpen
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }
            `}
            data-tooltip={keyframeEditorOpen ? 'Hide Keyframe Editor' : 'Keyframe Editor'}
            data-tooltip-side="right"
            aria-label={keyframeEditorOpen ? 'Hide keyframe editor' : 'Show keyframe editor'}
          >
            <LineChart className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content Panel */}
      <div
        className={`panel-bg border-r border-border overflow-hidden relative ${
          leftSidebarOpen ? '' : 'w-0'
        }`}
        style={leftSidebarOpen ? { width: sidebarWidth, transition: isResizingRef.current ? 'none' : 'width 200ms' } : { transition: 'width 200ms' }}
      >
        {/* Use Activity for React 19 performance optimization - defers updates when hidden */}
        <Activity mode={leftSidebarOpen ? 'visible' : 'hidden'}>
          <div className="h-full min-h-0 flex flex-col" style={{ width: sidebarWidth }}>
          <KeyframeGraphPanel
            isOpen={keyframeEditorOpen}
            onToggle={toggleKeyframeEditorOpen}
            onClose={() => setKeyframeEditorOpen(false)}
            placement="top"
          />

          {/* Panel Header — sits with the tab content, below the keyframe editor */}
          <div
            className="flex items-center justify-between px-3 border-b border-border flex-shrink-0"
            style={{ height: EDITOR_LAYOUT_CSS_VALUES.sidebarHeaderHeight }}
          >
            <span className="text-sm font-medium text-foreground">
              {categories.find((c) => c.id === activeTab)?.label}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              style={{ width: EDITOR_LAYOUT_CSS_VALUES.sidebarHeaderButtonSize, height: EDITOR_LAYOUT_CSS_VALUES.sidebarHeaderButtonSize }}
              onClick={toggleMediaFullColumn}
              data-tooltip={mediaFullColumn ? 'Dock to preview' : 'Expand full column'}
              data-tooltip-side="bottom"
            >
              {mediaFullColumn ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </Button>
          </div>

          {/* Media Tab - Full Media Library */}
          <div className={`min-h-0 flex-1 overflow-hidden ${activeTab === 'media' ? 'block' : 'hidden'}`}>
            <MediaLibrary />
          </div>

          {/* Text Tab */}
          <div className={`min-h-0 flex-1 overflow-y-auto p-3 ${activeTab === 'text' ? 'block' : 'hidden'}`}>
            <div className="space-y-3">
              <button
                draggable={true}
                onDragStart={handleTemplateDragStart({ itemType: 'text', label: 'Text' })}
                onDragEnd={handleTemplateDragEnd}
                onClick={() => {
                  if (shouldSuppressGeneratedItemClick()) return;
                  handleAddText();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 hover:border-primary/50 transition-colors group"
              >
                <div className="w-9 h-9 rounded-md bg-timeline-text/20 border border-timeline-text/50 flex items-center justify-center group-hover:bg-timeline-text/30 flex-shrink-0">
                  <Type className="w-4 h-4 text-timeline-text" />
                </div>
                <span className="text-sm text-muted-foreground group-hover:text-foreground">
                  Add Text
                </span>
              </button>

              {/* Timeline text items list */}
              <TextItemsList />
            </div>
          </div>

          {/* Shapes Tab */}
          <div className={`min-h-0 flex-1 overflow-y-auto p-3 ${activeTab === 'shapes' ? 'block' : 'hidden'}`}>
            <div className="grid grid-cols-3 gap-1.5">
                  <button
                    draggable={true}
                    onDragStart={handleTemplateDragStart({ itemType: 'shape', label: 'Rectangle', shapeType: 'rectangle' })}
                    onDragEnd={handleTemplateDragEnd}
                    onClick={() => {
                      if (shouldSuppressGeneratedItemClick()) return;
                      handleAddShape('rectangle');
                    }}
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 hover:border-primary/50 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded border border-border bg-secondary/50 flex items-center justify-center group-hover:bg-secondary/70">
                      <Square className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
                    </div>
                    <span className="text-[9px] text-muted-foreground group-hover:text-foreground">
                      Rectangle
                    </span>
                  </button>

                  <button
                    draggable={true}
                    onDragStart={handleTemplateDragStart({ itemType: 'shape', label: 'Circle', shapeType: 'circle' })}
                    onDragEnd={handleTemplateDragEnd}
                    onClick={() => {
                      if (shouldSuppressGeneratedItemClick()) return;
                      handleAddShape('circle');
                    }}
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 hover:border-primary/50 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded border border-border bg-secondary/50 flex items-center justify-center group-hover:bg-secondary/70">
                      <Circle className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
                    </div>
                    <span className="text-[9px] text-muted-foreground group-hover:text-foreground">
                      Circle
                    </span>
                  </button>

                  <button
                    draggable={true}
                    onDragStart={handleTemplateDragStart({ itemType: 'shape', label: 'Triangle', shapeType: 'triangle' })}
                    onDragEnd={handleTemplateDragEnd}
                    onClick={() => {
                      if (shouldSuppressGeneratedItemClick()) return;
                      handleAddShape('triangle');
                    }}
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 hover:border-primary/50 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded border border-border bg-secondary/50 flex items-center justify-center group-hover:bg-secondary/70">
                      <Triangle className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
                    </div>
                    <span className="text-[9px] text-muted-foreground group-hover:text-foreground">
                      Triangle
                    </span>
                  </button>

                  <button
                    draggable={true}
                    onDragStart={handleTemplateDragStart({ itemType: 'shape', label: 'Ellipse', shapeType: 'ellipse' })}
                    onDragEnd={handleTemplateDragEnd}
                    onClick={() => {
                      if (shouldSuppressGeneratedItemClick()) return;
                      handleAddShape('ellipse');
                    }}
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 hover:border-primary/50 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded border border-border bg-secondary/50 flex items-center justify-center group-hover:bg-secondary/70">
                      <Circle className="w-3.5 h-2.5 text-muted-foreground group-hover:text-foreground" />
                    </div>
                    <span className="text-[9px] text-muted-foreground group-hover:text-foreground">
                      Ellipse
                    </span>
                  </button>

                  <button
                    draggable={true}
                    onDragStart={handleTemplateDragStart({ itemType: 'shape', label: 'Star', shapeType: 'star' })}
                    onDragEnd={handleTemplateDragEnd}
                    onClick={() => {
                      if (shouldSuppressGeneratedItemClick()) return;
                      handleAddShape('star');
                    }}
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 hover:border-primary/50 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded border border-border bg-secondary/50 flex items-center justify-center group-hover:bg-secondary/70">
                      <Star className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
                    </div>
                    <span className="text-[9px] text-muted-foreground group-hover:text-foreground">
                      Star
                    </span>
                  </button>

                  <button
                    draggable={true}
                    onDragStart={handleTemplateDragStart({ itemType: 'shape', label: 'Polygon', shapeType: 'polygon' })}
                    onDragEnd={handleTemplateDragEnd}
                    onClick={() => {
                      if (shouldSuppressGeneratedItemClick()) return;
                      handleAddShape('polygon');
                    }}
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 hover:border-primary/50 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded border border-border bg-secondary/50 flex items-center justify-center group-hover:bg-secondary/70">
                      <Hexagon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
                    </div>
                    <span className="text-[9px] text-muted-foreground group-hover:text-foreground">
                      Polygon
                    </span>
                  </button>

                  <button
                    draggable={true}
                    onDragStart={handleTemplateDragStart({ itemType: 'shape', label: 'Heart', shapeType: 'heart' })}
                    onDragEnd={handleTemplateDragEnd}
                    onClick={() => {
                      if (shouldSuppressGeneratedItemClick()) return;
                      handleAddShape('heart');
                    }}
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 hover:border-primary/50 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded border border-border bg-secondary/50 flex items-center justify-center group-hover:bg-secondary/70">
                      <Heart className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
                    </div>
                    <span className="text-[9px] text-muted-foreground group-hover:text-foreground">
                      Heart
                    </span>
                  </button>

                  <button
                    onClick={() => useMaskEditorStore.getState().startShapePenMode()}
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 hover:border-primary/50 transition-colors group"
                    title="Draw a custom shape mask with the pen tool"
                  >
                    <div className="w-7 h-7 rounded border border-border bg-secondary/50 flex items-center justify-center group-hover:bg-secondary/70">
                      <Pen className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
                    </div>
                    <span className="text-[9px] text-muted-foreground group-hover:text-foreground">
                      Pen
                    </span>
                  </button>
            </div>
          </div>

          {/* Effects Tab */}
          <div className={`min-h-0 flex-1 overflow-y-auto p-3 ${activeTab === 'effects' ? 'block' : 'hidden'}`}>
            <div className="space-y-3">
              {/* Blank Adjustment Layer */}
              <button
                draggable={true}
                onDragStart={handleTemplateDragStart({ itemType: 'adjustment', label: 'Adjustment Layer' })}
                onDragEnd={handleTemplateDragEnd}
                onClick={() => {
                  if (shouldSuppressGeneratedItemClick()) return;
                  handleAddAdjustmentLayer();
                }}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 hover:border-primary/50 transition-colors group"
              >
                <div className="w-8 h-8 rounded-md border border-border bg-secondary/50 flex items-center justify-center group-hover:bg-secondary/70 flex-shrink-0">
                  <Layers className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                </div>
                <div className="text-left">
                  <div className="text-xs text-muted-foreground group-hover:text-foreground">
                    Blank Adjustment Layer
                  </div>
                </div>
              </button>

              {/* Presets */}
              <div>
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                  Presets
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {EFFECT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      draggable={true}
                      onDragStart={handleTemplateDragStart({
                        itemType: 'adjustment',
                        label: preset.name,
                        effects: preset.effects,
                      })}
                      onDragEnd={handleTemplateDragEnd}
                      onClick={() => {
                        if (shouldSuppressGeneratedItemClick()) return;
                        handleAddPreset(preset.id);
                      }}
                      className="flex flex-col items-center gap-1 p-1.5 rounded-md border border-border bg-secondary/30 hover:bg-secondary/50 hover:border-primary/50 transition-colors group"
                    >
                      {effectPreviews.has(`preset:${preset.id}`) ? (
                        <img
                          src={effectPreviews.get(`preset:${preset.id}`)}
                          alt=""
                          draggable={false}
                          className="w-full aspect-video rounded-sm object-cover"
                        />
                      ) : (
                        <div className="w-full aspect-video rounded-sm bg-muted flex items-center justify-center">
                          <Sparkles className="w-3 h-3 text-muted-foreground/50" />
                        </div>
                      )}
                      <span className="text-[9px] text-muted-foreground group-hover:text-foreground text-center leading-tight">
                        {preset.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* GPU Effects by Category */}
              {gpuCategories.map(({ category, effects: catEffects }) => (
                <div key={category}>
                  <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                    {category}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {catEffects.map((def) => {
                      const inert = gpuUnavailable && !hasCssEquivalent(def.id);
                      return (
                      <button
                        key={def.id}
                        draggable={!inert}
                        disabled={inert}
                        title={inert ? 'Needs WebGPU — unavailable in this browser' : def.name}
                        onDragStart={handleTemplateDragStart({
                          itemType: 'adjustment',
                          label: def.name,
                          effects: [{
                            type: 'gpu-effect',
                            gpuEffectType: def.id,
                            params: getGpuEffectDefaultParams(def.id),
                          }],
                        })}
                        onDragEnd={handleTemplateDragEnd}
                        onClick={() => {
                          if (shouldSuppressGeneratedItemClick()) return;
                          handleAddGpuEffect(def.id);
                        }}
                        className={`flex flex-col items-center gap-1 p-1.5 rounded-md border border-border transition-colors group ${
                          inert
                            ? 'opacity-40 cursor-not-allowed bg-secondary/10'
                            : 'bg-secondary/30 hover:bg-secondary/50 hover:border-primary/50'
                        }`}
                      >
                        {effectPreviews.has(def.id) ? (
                          <img
                            src={effectPreviews.get(def.id)}
                            alt=""
                            draggable={false}
                            className="w-full aspect-video rounded-sm object-cover"
                          />
                        ) : (
                          <div className="w-full aspect-video rounded-sm bg-muted" />
                        )}
                        <span className="text-[9px] text-muted-foreground group-hover:text-foreground text-center leading-tight truncate w-full">
                          {def.name}{inert ? ' · GPU' : ''}
                        </span>
                      </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Transitions Tab */}
          <div className={`min-h-0 flex-1 overflow-hidden ${activeTab === 'transitions' ? 'block' : 'hidden'}`}>
            <TransitionsPanel />
          </div>

          {/* Animations Tab */}
          <div className={`min-h-0 flex-1 overflow-hidden ${activeTab === 'animations' ? 'block' : 'hidden'}`}>
            <AnimationsPanel />
          </div>

          {/* AI Tab */}
          <div className={`min-h-0 flex-1 overflow-hidden ${activeTab === 'ai' ? 'block' : 'hidden'}`}>
            <AiPanel />
          </div>
          </div>
        </Activity>
        {/* Resize Handle */}
        {leftSidebarOpen && (
          <div
            data-resize-handle
            onMouseDown={handleResizeStart}
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/50 active:bg-primary/50 transition-colors z-10"
          />
        )}
      </div>
    </div>
  );
});

function TextItemsList() {
  const items = useTimelineStore((s) => s.items);
  const fps = useTimelineStore((s) => s.fps) || 30;
  const selectedItemIds = useSelectionStore((s) => s.selectedItemIds);
  const selectItems = useSelectionStore((s) => s.selectItems);

  const textItems = useMemo(
    () => items
      .filter((item) => item.type === 'text')
      .sort((a, b) => a.from - b.from),
    [items]
  );

  if (textItems.length === 0) return null;

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-2">
        Timeline Texts ({textItems.length})
      </div>
      <div className="space-y-1">
        {textItems.map((item) => (
          <TextItemRow
            key={item.id}
            item={item}
            fps={fps}
            isSelected={selectedItemIds.includes(item.id)}
            onSelect={() => selectItems([item.id])}
          />
        ))}
      </div>
    </div>
  );
}

function TextItemRow({ item, fps, isSelected, onSelect }: {
  item: any;
  fps: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.text || '');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const startSec = (item.from / fps).toFixed(1);
  const isCaption = !!item.captionSource;

  useEffect(() => {
    setEditText(item.text || '');
  }, [item.text]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = () => {
    if (editText.trim() !== item.text) {
      const { updateItem } = useTimelineStore.getState();
      if (typeof updateItem === 'function') {
        updateItem(item.id, { text: editText.trim(), label: editText.trim().split('\n')[0] || 'Text' });
      } else {
        // Fallback: import directly
        import('@/features/timeline/stores/actions/item-actions').then(({ updateItem: ui }) => {
          ui(item.id, { text: editText.trim(), label: editText.trim().split('\n')[0] || 'Text' });
        });
      }
    }
    setEditing(false);
  };

  return (
    <div
      onClick={onSelect}
      className={`rounded-lg border p-2 cursor-pointer transition-all ${
        isSelected
          ? 'border-primary/50 bg-primary/10'
          : 'border-border/50 bg-secondary/20 hover:border-border hover:bg-secondary/30'
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="w-5 h-5 rounded bg-timeline-text/20 flex items-center justify-center shrink-0 mt-0.5">
          <Type className="w-3 h-3 text-timeline-text" />
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <textarea
              ref={inputRef}
              value={editText}
              onChange={(e) => {
                setEditText(e.target.value);
                // Live preview: update immediately
                import('@/features/timeline/stores/actions/item-actions').then(({ updateItem: ui }) => {
                  ui(item.id, { text: e.target.value, label: e.target.value.split('\n')[0] || 'Text' });
                });
              }}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setEditText(item.text || ''); setEditing(false); }
                e.stopPropagation();
              }}
              rows={2}
              className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground resize-y focus:border-primary focus:outline-none"
            />
          ) : (
            <p
              className="text-xs text-foreground line-clamp-2 cursor-text"
              onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            >
              {item.text || 'Empty text'}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground/60">{startSec}s</span>
            {isCaption && (
              <span className="text-[9px] text-purple-400/60 bg-purple-500/10 px-1 rounded">caption</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
