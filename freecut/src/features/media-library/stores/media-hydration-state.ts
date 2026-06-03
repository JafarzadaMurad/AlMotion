import { create } from 'zustand';
import type { HydrationProgress } from '../services/media-sync-service';

/**
 * Tiny zustand store that surfaces "downloading project media from the
 * server" progress to UI overlays. Written from the editor's route loader
 * (outside of React) and consumed by a top-level overlay component.
 *
 * The store stays alive across route changes; the loader resets it on
 * entry and clears it on exit.
 */
interface MediaHydrationState {
  active: boolean;
  downloaded: number;
  total: number;
  set: (progress: HydrationProgress) => void;
}

export const useMediaHydrationStore = create<MediaHydrationState>((set) => ({
  active: false,
  downloaded: 0,
  total: 0,
  set: (progress) => set(progress),
}));

/** Imperative setter usable from non-React contexts (e.g. the route loader). */
export function setMediaHydrationProgress(progress: HydrationProgress): void {
  useMediaHydrationStore.getState().set(progress);
}
