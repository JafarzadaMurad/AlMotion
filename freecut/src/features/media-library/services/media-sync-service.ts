/**
 * Cross-device media persistence. The editor stores imported media in
 * OPFS (origin-private filesystem) for fast playback, but that data is
 * tied to the browser/profile that did the import. This service handles
 * the two flows that make a project work on every device the user
 * signs into:
 *
 *  1. upload-after-import: once a clip is in OPFS we POST it to the
 *     backend so the file lives next to the project_id on the server.
 *     The client UUID travels with the upload as `client_media_id` so
 *     the timeline_data JSON (which references that UUID) still
 *     resolves cleanly on a fresh device.
 *
 *  2. hydrate-on-open: when the editor loads a project, we list the
 *     server's media for that project and re-create any IndexedDB +
 *     OPFS entries that are missing locally. After this runs, the
 *     existing orphan-detection in timeline-store-facade finds
 *     everything it needs.
 *
 * Both flows are best-effort: any failure logs and continues so a
 * temporary backend hiccup never blocks editing.
 */

import {
  createMedia as createMediaDB,
  getMedia as getMediaDB,
  updateMedia as updateMediaDB,
  associateMediaWithProject,
  saveThumbnail as saveThumbnailDB,
  getThumbnailByMediaId,
} from '@/infrastructure/storage/indexeddb';
import { generateThumbnail } from '../utils/thumbnail-generator';
import {
  fetchProjectMedia,
  uploadProjectMedia,
  type ServerMediaFile,
} from '@/infrastructure/api/project-api';
import { opfsService } from './opfs-service';
import { createLogger } from '@/shared/logging/logger';
import type { MediaMetadata } from '@/types/storage';

const logger = createLogger('MediaSyncService');

export interface HydrationProgress {
  active: boolean;
  downloaded: number;
  total: number;
}

function opfsPathForMedia(mediaId: string): string {
  return `content/${mediaId.slice(0, 2)}/${mediaId.slice(2, 4)}/${mediaId}/data`;
}

/**
 * Push a single locally-imported media file up to the backend so it
 * outlives this browser profile. Idempotent — the server returns the
 * existing row if `client_media_id` is already known for the project.
 *
 * On success the IndexedDB row is updated with `serverMediaId` and
 * `syncStatus: 'synced'`. On failure status flips to 'failed' so a UI
 * can offer a manual retry.
 */
export async function uploadMediaToServer(
  media: MediaMetadata,
  projectId: string,
): Promise<MediaMetadata> {
  await updateMediaDB(media.id, { syncStatus: 'pending' });

  try {
    let blob: Blob;
    if (media.storageType === 'opfs' && media.opfsPath) {
      const buf = await opfsService.getFile(media.opfsPath);
      blob = new Blob([buf], { type: media.mimeType || 'application/octet-stream' });
    } else if (media.storageType === 'handle' && media.fileHandle) {
      blob = await media.fileHandle.getFile();
    } else {
      throw new Error(`Media ${media.id} has no readable source for upload`);
    }

    const type: 'video' | 'audio' | 'image' =
      media.mimeType.startsWith('audio/') ? 'audio'
        : media.mimeType.startsWith('image/') ? 'image'
          : 'video';

    const serverRow = await uploadProjectMedia(projectId, {
      file: blob,
      fileName: media.fileName,
      type,
      clientMediaId: media.id,
      duration: media.duration,
      width: media.width,
      height: media.height,
      fps: media.fps,
    });

    const updated: Partial<MediaMetadata> = {
      serverMediaId: serverRow.id,
      syncStatus: 'synced',
    };
    await updateMediaDB(media.id, updated);
    logger.info(`Uploaded media ${media.id} -> server media #${serverRow.id}`);
    return { ...media, ...updated };
  } catch (err) {
    logger.warn(`Upload failed for media ${media.id}`, err);
    await updateMediaDB(media.id, { syncStatus: 'failed' });
    throw err;
  }
}

/**
 * Pull anything the server has for this project into local IndexedDB +
 * OPFS that we don't already have. Run this BEFORE orphan detection
 * fires on project load.
 *
 * The contract: when this resolves, every server-known media row has
 * a matching IndexedDB row keyed by `client_media_id` (or the numeric
 * server id stringified, as a fallback for server-only imports from
 * MCP / yt-dlp that never had a client UUID).
 */
export async function hydrateProjectMediaFromServer(
  projectId: string,
  onProgress?: (downloaded: number, total: number) => void,
): Promise<{ added: number; skipped: number; failed: number }> {
  let serverMedia: ServerMediaFile[];
  try {
    serverMedia = await fetchProjectMedia(projectId);
  } catch (err) {
    logger.warn(`Could not fetch server media for project ${projectId}`, err);
    return { added: 0, skipped: 0, failed: 0 };
  }

  if (serverMedia.length === 0) {
    return { added: 0, skipped: 0, failed: 0 };
  }

  let added = 0;
  let skipped = 0;
  let failed = 0;
  let downloaded = 0;

  for (const row of serverMedia) {
    const clientId = row.client_media_id ?? `server-${row.id}`;
    const existing = await getMediaDB(clientId).catch(() => undefined);
    if (existing) {
      // Already local — just make sure the project association is in
      // place (the row might predate this device's project list).
      try {
        await associateMediaWithProject(projectId, clientId);
        if (!existing.serverMediaId) {
          await updateMediaDB(clientId, {
            serverMediaId: row.id,
            syncStatus: 'synced',
          });
        }
      } catch (err) {
        logger.warn(`Re-associating media ${clientId} with project ${projectId} failed`, err);
      }
      skipped++;
      continue;
    }

    if (!row.url) {
      logger.warn(`Server media ${row.id} has no public URL — skipping`);
      failed++;
      continue;
    }

    try {
      const resp = await fetch(row.url, { credentials: 'omit' });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const buf = await resp.arrayBuffer();
      const opfsPath = opfsPathForMedia(clientId);
      await opfsService.saveFile(opfsPath, buf);

      const fpsNum = row.fps == null ? 0 : Number(row.fps);
      const meta: MediaMetadata = {
        id: clientId,
        storageType: 'opfs',
        opfsPath,
        fileName: row.name,
        fileSize: row.size,
        mimeType: row.mime_type,
        duration: row.duration ?? 0,
        width: row.width ?? 0,
        height: row.height ?? 0,
        fps: Number.isFinite(fpsNum) ? fpsNum : 0,
        codec: '',
        bitrate: 0,
        tags: [],
        createdAt: Date.parse(row.created_at) || Date.now(),
        updatedAt: Date.now(),
        serverMediaId: row.id,
        syncStatus: 'synced',
      };
      await createMediaDB(meta);
      await associateMediaWithProject(projectId, clientId);
      await ensureThumbnailForMedia(
        clientId,
        new Blob([buf], { type: row.mime_type || 'application/octet-stream' }),
        row.name,
        row.mime_type,
      );
      added++;
      downloaded++;
      onProgress?.(downloaded, serverMedia.length);
    } catch (err) {
      logger.warn(`Hydration failed for server media ${row.id}`, err);
      failed++;
    }
  }

  logger.info(`Hydrated project ${projectId}: +${added} new / ${skipped} kept / ${failed} failed`);
  return { added, skipped, failed };
}

/**
 * Re-download a single media file from the server and re-point its local
 * row at an OPFS copy.
 *
 * This exists because `hydrateProjectMediaFromServer` deliberately skips any
 * media that already has a local IndexedDB row — but "has a row" is not the
 * same as "is readable". A handle-backed row whose permission has lapsed
 * (`requestPermission` needs a user gesture the resolver cannot provide) is
 * present but dead, so hydration walks past it and resolution then fails.
 *
 * Recovery converts such a row to `storageType: 'opfs'`, which has no
 * permission model and survives every future session. Returns the downloaded
 * blob so the caller can use it immediately, or null when the server has
 * nothing for this media.
 */
export async function recoverMediaFromServer(
  mediaId: string,
  projectId: string,
): Promise<Blob | null> {
  let serverMedia: ServerMediaFile[];
  try {
    serverMedia = await fetchProjectMedia(projectId);
  } catch (err) {
    logger.warn(`Cannot reach server to recover media ${mediaId}`, err);
    return null;
  }

  const local = await getMediaDB(mediaId).catch(() => undefined);
  // Match on the client UUID first; fall back to the numeric server id both
  // as a stringified client id (server-only imports) and via the local row's
  // recorded serverMediaId.
  const row = serverMedia.find((candidate) => (
    candidate.client_media_id === mediaId
    || `server-${candidate.id}` === mediaId
    || (local?.serverMediaId != null && candidate.id === local.serverMediaId)
  ));

  if (!row?.url) {
    logger.warn(`Server has no downloadable copy of media ${mediaId}`);
    return null;
  }

  try {
    const response = await fetch(row.url, { credentials: 'omit' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();

    const opfsPath = opfsPathForMedia(mediaId);
    await opfsService.saveFile(opfsPath, buffer);

    // Drop the dead handle in the same write that installs the OPFS path, so
    // no later read can pick the stale source back up.
    await updateMediaDB(mediaId, {
      storageType: 'opfs',
      opfsPath,
      fileHandle: undefined,
      serverMediaId: row.id,
      syncStatus: 'synced',
      updatedAt: Date.now(),
    });

    const blob = new Blob([buffer], { type: row.mime_type || 'application/octet-stream' });
    await ensureThumbnailForMedia(mediaId, blob, row.name, row.mime_type);

    logger.info(`Recovered media ${mediaId} from server media #${row.id}`);
    return blob;
  } catch (err) {
    logger.warn(`Recovery download failed for media ${mediaId}`, err);
    return null;
  }
}

/**
 * Build and store a thumbnail for media that arrived from the server.
 *
 * Thumbnails live in their own IndexedDB store and are never uploaded, so a
 * device that hydrates a project has the bytes but no preview image and the
 * media library falls back to a generic file icon. Regenerating locally from
 * the downloaded blob costs one decode and keeps the library looking the same
 * on every device.
 *
 * Best-effort by design: a missing thumbnail is cosmetic, so failures are
 * logged and swallowed rather than failing the hydration that produced it.
 */
async function ensureThumbnailForMedia(
  mediaId: string,
  blob: Blob,
  fileName: string,
  mimeType: string,
): Promise<void> {
  try {
    const existing = await getThumbnailByMediaId(mediaId).catch(() => undefined);
    if (existing) return;

    const file = new File([blob], fileName, { type: mimeType || blob.type });
    const thumbnailBlob = await generateThumbnail(file, { maxSize: 320, quality: 0.6 });

    await saveThumbnailDB({
      id: crypto.randomUUID(),
      mediaId,
      blob: thumbnailBlob,
      timestamp: 1,
      width: 320,
      height: 180,
    });
    await updateMediaDB(mediaId, { updatedAt: Date.now() });
  } catch (err) {
    logger.warn(`Could not build a thumbnail for media ${mediaId}`, err);
  }
}
