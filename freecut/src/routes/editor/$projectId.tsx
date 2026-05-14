import { createFileRoute } from '@tanstack/react-router';
import { CURRENT_SCHEMA_VERSION } from '@/domain/projects/migrations';
import { fetchProject } from '@/infrastructure/api/project-api';
import { getProjectLocalData } from '@/infrastructure/storage/indexeddb/project-local-data';

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
