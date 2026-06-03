import {
  associateMediaWithProject,
  createProject,
  deleteProject,
  getProject,
  getProjectMediaIds,
  getThumbnail,
  removeMediaFromProject,
  saveThumbnail,
  updateProject,
} from '@/infrastructure/storage/indexeddb';
import { createLogger } from '@/shared/logging/logger';
import type { Project } from '@/types/project';
import {
  duplicateProject,
  formatProjectUpgradeBackupName,
} from '../utils/project-helpers';

const logger = createLogger('ProjectUpgradeService');

interface CreateProjectUpgradeBackupOptions {
  backupName?: string;
  fromVersion: number;
  toVersion: number;
}

/**
 * Create a restorable backup of a project before running a schema upgrade.
 *
 * The backup remains on the legacy schema version and keeps the original
 * project media associations so it can still be opened independently later.
 */
/**
 * The result of attempting to create a local backup. `'skipped'` means the
 * project doesn't live in IndexedDB on this device (e.g. the user opened it
 * fresh from another machine) — in that case the only canonical copy is
 * server-side and we can't / don't need to make a local backup.
 */
export type ProjectUpgradeBackupResult =
  | { status: 'created'; project: Project }
  | { status: 'skipped'; reason: 'no-local-copy' };

export async function createProjectUpgradeBackup(
  projectId: string,
  options: CreateProjectUpgradeBackupOptions
): Promise<ProjectUpgradeBackupResult> {
  const project = await getProject(projectId);
  if (!project) {
    // The project isn't in IndexedDB — this device just fetched it from the
    // server. There is no local state to back up; let the caller proceed
    // with the in-memory migration. The pre-upgrade copy still exists on
    // the server until the user explicitly saves the upgraded version.
    logger.info(`No IndexedDB record for project ${projectId} — skipping local upgrade backup`);
    return { status: 'skipped', reason: 'no-local-copy' };
  }

  const backup = duplicateProject(project);
  backup.name = options.backupName
    ?? formatProjectUpgradeBackupName(project.name, options.fromVersion, options.toVersion);
  backup.thumbnailId = undefined;

  await createProject(backup);

  const associatedMediaIds: string[] = [];
  try {
    const mediaIds = await getProjectMediaIds(projectId);
    for (const mediaId of mediaIds) {
      await associateMediaWithProject(backup.id, mediaId);
      associatedMediaIds.push(mediaId);
    }
  } catch (error) {
    for (const mediaId of associatedMediaIds) {
      try {
        await removeMediaFromProject(backup.id, mediaId);
      } catch (cleanupError) {
        logger.warn(`Failed to remove backup media association ${mediaId} during rollback`, cleanupError);
      }
    }

    try {
      await deleteProject(backup.id);
    } catch (cleanupError) {
      logger.warn(`Failed to roll back backup project ${backup.id}`, cleanupError);
    }

    throw error;
  }

  if (!project.thumbnailId) {
    return { status: 'created', project: backup };
  }

  try {
    const thumbnail = await getThumbnail(project.thumbnailId);
    if (!thumbnail) {
      return { status: 'created', project: backup };
    }

    const backupThumbnailId = `project:${backup.id}:cover`;
    await saveThumbnail({
      ...thumbnail,
      id: backupThumbnailId,
      mediaId: backup.id,
      timestamp: Date.now(),
    });

    await updateProject(backup.id, {
      thumbnailId: backupThumbnailId,
      thumbnail: undefined,
    });

    return {
      status: 'created',
      project: {
        ...backup,
        thumbnailId: backupThumbnailId,
        thumbnail: undefined,
      },
    };
  } catch (error) {
    logger.warn(`Failed to copy thumbnail for backup project ${backup.id}`, error);
    return { status: 'created', project: backup };
  }
}
