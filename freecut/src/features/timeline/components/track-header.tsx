import { memo } from 'react';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Power, PowerOff, Lock, GripVertical, Radio, FoldHorizontal,
  Film, Music, Type as TypeIcon,
} from 'lucide-react';
import type { TimelineTrack } from '@/types/timeline';
import { useTrackDrag } from '../hooks/use-track-drag';
import { TIMELINE_SIDEBAR_WIDTH } from '../constants';
import { EDITOR_LAYOUT_CSS_VALUES } from '@/shared/ui/editor-layout';
import { useItemsStore } from '../stores/items-store';
import { getTrackKind } from '@/features/timeline/utils/classic-tracks';

interface TrackHeaderProps {
  track: TimelineTrack;
  isActive: boolean;
  isSelected: boolean;
  canDeleteTrack: boolean;
  canDeleteEmptyTracks: boolean;
  onToggleLock: () => void;
  onToggleDisabled: () => void;
  onToggleSolo: () => void;
  onSelect: (e: React.MouseEvent) => void;
  onCloseGaps?: () => void;
  onAddVideoTrack: () => void;
  onAddAudioTrack: () => void;
  onDeleteTrack: () => void;
  onDeleteEmptyTracks: () => void;
}

/**
 * Custom equality for TrackHeader memo - ignores callback props which are recreated each render
 */
function areTrackHeaderPropsEqual(prev: TrackHeaderProps, next: TrackHeaderProps): boolean {
  return (
    prev.track === next.track &&
    prev.isActive === next.isActive &&
    prev.isSelected === next.isSelected &&
    prev.canDeleteTrack === next.canDeleteTrack &&
    prev.canDeleteEmptyTracks === next.canDeleteEmptyTracks
  );
  // Callbacks (onToggleLock, etc.) are ignored - they're recreated each render but functionality is same
}

/**
 * Track Header Component
 *
 * Displays track name, controls, and handles selection.
 * Shows active state with background color.
 * Supports group tracks with collapse/expand and indentation.
 * Right-click context menu for track actions.
 * Memoized to prevent re-renders when props haven't changed.
 */
export const TrackHeader = memo(function TrackHeader({
  track,
  isActive,
  isSelected,
  canDeleteTrack,
  canDeleteEmptyTracks,
  onToggleLock,
  onToggleDisabled,
  onToggleSolo,
  onSelect,
  onCloseGaps,
  onAddVideoTrack,
  onAddAudioTrack,
  onDeleteTrack,
  onDeleteEmptyTracks,
}: TrackHeaderProps) {
  // NOTE: never return a freshly-created `[]` from a Zustand selector — every render gives a
  // new reference and triggers an infinite re-render loop. Read the stored array directly
  // (it stays referentially stable until items change) and treat undefined explicitly.
  const trackItems = useItemsStore((s) => s.itemsByTrackId[track.id]);
  const trackKind = getTrackKind(track);
  const isTrackDisabled = trackKind === 'audio'
    ? track.muted
    : trackKind === 'video'
      ? track.visible === false
      : track.visible === false || track.muted;

  // Choose track icon by content (text-only video tracks render as T)
  const onlyTextItems = !!trackItems && trackItems.length > 0 && trackItems.every((it) => it.type === 'text');
  const TrackTypeIcon = trackKind === 'audio'
    ? Music
    : onlyTextItems
      ? TypeIcon
      : Film;

  // Use track drag hook (visuals handled centrally by timeline.tsx via DOM)
  const { handleDragStart } = useTrackDrag(track);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={`
            flex flex-row items-center overflow-hidden px-1
            cursor-grab active:cursor-grabbing relative
            ${isSelected ? 'bg-primary/10' : 'hover:bg-secondary/50'}
            ${isActive ? 'border-l-3 border-l-primary' : 'border-l-3 border-l-transparent'}
            transition-colors duration-150
          `}
          style={{
            height: `${track.height}px`,
            // content-visibility optimization for long track lists (rendering-content-visibility)
            contentVisibility: 'auto',
            containIntrinsicSize: `${TIMELINE_SIDEBAR_WIDTH}px ${track.height}px`,
          }}
          onClick={onSelect}
          onMouseDown={handleDragStart}
          data-track-id={track.id}
        >
          <div className="flex h-full shrink-0 items-center gap-0.5 overflow-hidden px-0.5">
            <div className="flex h-5 w-3 shrink-0 items-center justify-center">
              <GripVertical className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
            </div>

            {/* Track type icon (replaces verbose 'V1 12 Clips' / 'B-Roll' labels) */}
            <div
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground"
              aria-label={`${trackKind} track`}
              data-tooltip={trackKind === 'audio' ? 'Audio' : 'Video / Text'}
            >
              <TrackTypeIcon className="w-3.5 h-3.5" />
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="rounded hover:bg-secondary"
              style={{ width: EDITOR_LAYOUT_CSS_VALUES.toolbarButtonSize, height: EDITOR_LAYOUT_CSS_VALUES.toolbarButtonSize }}
              onClick={(e) => {
                e.stopPropagation();
                onToggleDisabled();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label={isTrackDisabled ? 'Enable track' : 'Disable track'}
              data-tooltip={isTrackDisabled ? 'Enable track' : 'Disable track'}
            >
              {isTrackDisabled ? (
                <PowerOff className="w-3 h-3 text-primary" />
              ) : (
                <Power className="w-3 h-3 opacity-70" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="rounded hover:bg-secondary"
              style={{ width: EDITOR_LAYOUT_CSS_VALUES.toolbarButtonSize, height: EDITOR_LAYOUT_CSS_VALUES.toolbarButtonSize }}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSolo();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label={track.solo ? 'Unsolo track' : 'Solo track'}
              data-tooltip={track.solo ? 'Unsolo track' : 'Solo track'}
            >
              <Radio className={`w-3 h-3 ${track.solo ? 'text-primary' : ''}`} />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="rounded hover:bg-secondary"
              style={{ width: EDITOR_LAYOUT_CSS_VALUES.toolbarButtonSize, height: EDITOR_LAYOUT_CSS_VALUES.toolbarButtonSize }}
              onClick={(e) => {
                e.stopPropagation();
                onToggleLock();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label={track.locked ? 'Unlock track' : 'Lock track'}
              data-tooltip={track.locked ? 'Unlock track' : 'Lock track'}
            >
              <Lock className={`w-3 h-3 ${track.locked ? 'text-primary' : 'opacity-70'}`} />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="rounded hover:bg-secondary"
              style={{ width: EDITOR_LAYOUT_CSS_VALUES.toolbarButtonSize, height: EDITOR_LAYOUT_CSS_VALUES.toolbarButtonSize }}
              onClick={(e) => {
                e.stopPropagation();
                onCloseGaps?.();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label="Close all gaps"
              data-tooltip="Close all gaps"
            >
              <FoldHorizontal className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-52">
        <ContextMenuItem onClick={onCloseGaps}>
          Close All Gaps
        </ContextMenuItem>

        <ContextMenuSeparator />
        <ContextMenuItem onClick={onAddVideoTrack}>
          Add Video Track
        </ContextMenuItem>
        <ContextMenuItem onClick={onAddAudioTrack}>
          Add Audio Track
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={!canDeleteTrack} onClick={onDeleteTrack}>
          Delete Track
        </ContextMenuItem>
        <ContextMenuItem disabled={!canDeleteEmptyTracks} onClick={onDeleteEmptyTracks}>
          Delete Empty Tracks
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}, areTrackHeaderPropsEqual);
