import { createFileRoute } from '@tanstack/react-router';
import { CURRENT_SCHEMA_VERSION } from '@/domain/projects/migrations';
import { fetchProject } from '@/infrastructure/api/project-api';
import { getProjectLocalData } from '@/infrastructure/storage/indexeddb/project-local-data';
import {
  hydrateProjectMediaFromServer,
  type HydrationProgress,
} from '@/features/media-library/services/media-sync-service';
import { setMediaHydrationProgress } from '@/features/media-library/stores/media-hydration-state';

export const Route = createFileRoute('/editor/$projectId')({
  // Editor loader data is tiny and migration state must be fresh on reopen.
  // Avoid keeping inactive editor matches around with stale "requires upgrade" flags.
  gcTime: 0,
  preloadGcTime: 0,
  loader: async ({ params }) => {
    // Validate project exists via backend API
    const project = await fetchProject(params.projectId);

    if (!project) {
      throw new Error(`Project not found: ${params.projectId}`);
    }

    // Cross-device persistence: pull any server-side media into local
    // IndexedDB + OPFS BEFORE the timeline-store does orphan detection.
    // Best-effort — a failure here just means the existing
    // "Missing Media References" dialog has a chance to fire. Progress is
    // published to a zustand-ish store so the editor can render a loading
    // overlay while the bytes come down.
    setMediaHydrationProgress({ active: true, downloaded: 0, total: 0 });
    try {
      await hydrateProjectMediaFromServer(project.id, (downloaded, total) => {
        const progress: HydrationProgress = { active: true, downloaded, total };
        setMediaHydrationProgress(progress);
      });
    } catch {
      // ignore — fall through to local detection
    } finally {
      setMediaHydrationProgress({ active: false, downloaded: 0, total: 0 });
    }

    // Merge with client-only local data
    const localData = await getProjectLocalData(project.id);
    // New projects from backend have no schemaVersion and no timeline — treat as current version
    const hasTimeline = project.timeline && project.timeline.tracks && project.timeline.tracks.length > 0;
    const storedSchemaVersion = localData?.schemaVersion ?? project.schemaVersion ?? (hasTimeline ? 1 : CURRENT_SCHEMA_VERSION);

    // Only pass metadata needed for Editor initialization (not timeline data)
    return {
      project: {
        id: project.id,
        name: project.name,
        width: project.metadata.width,
        height: project.metadata.height,
        fps: project.metadata.fps,
        backgroundColor: project.metadata.backgroundColor,
      },
      migration: {
        storedSchemaVersion,
        currentSchemaVersion: CURRENT_SCHEMA_VERSION,
        requiresUpgrade: storedSchemaVersion < CURRENT_SCHEMA_VERSION,
      },
    };
  },
});
