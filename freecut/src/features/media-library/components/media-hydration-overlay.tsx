import { useMediaHydrationStore } from '../stores/media-hydration-state';
import { Loader2 } from 'lucide-react';

/**
 * Full-screen-ish overlay rendered above the editor while the loader is
 * downloading project media from the server (cross-device first open).
 * Dismisses itself when the hydration store flips `active` back to false.
 */
export function MediaHydrationOverlay() {
  const active = useMediaHydrationStore((s) => s.active);
  const downloaded = useMediaHydrationStore((s) => s.downloaded);
  const total = useMediaHydrationStore((s) => s.total);

  if (!active) return null;

  const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0;
  const label = total > 0
    ? `Downloading project media… (${downloaded} / ${total})`
    : 'Looking for project media on the server…';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="flex w-[min(90vw,420px)] flex-col items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        <div className="text-center text-sm text-zinc-200">{label}</div>
        {total > 0 && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-blue-500 transition-[width] duration-200"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
        <p className="text-xs text-zinc-500">
          First time opening this project from this device.
        </p>
      </div>
    </div>
  );
}
