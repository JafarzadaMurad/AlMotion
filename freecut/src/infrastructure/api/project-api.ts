import { ApiClient } from './api-client';
import type { Project, ProjectTimeline, ProjectResolution } from '@/types/project';

// Backend response shape
interface BackendProject {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  width: number;
  height: number;
  fps: number;
  background_color: string;
  /** Appended by the Project model; null until a cover has been uploaded. */
  thumbnail_url: string | null;
  timeline_data: ProjectTimeline | null;
  settings: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  media_files_count?: number;
}

// --- Mappers ---

function backendToFrontend(bp: BackendProject): Project {
  // schemaVersion is serialized inside timeline_data by the editor on save.
  // Read it back here so the loader's "needs upgrade?" check doesn't
  // misdetect a fresh v9 project as v1 (which is what happens when
  // schemaVersion is missing from Project and the heuristic falls back to
  // "has timeline -> assume v1").
  const tlWithVersion = bp.timeline_data as
    | (NonNullable<BackendProject['timeline_data']> & { schemaVersion?: number })
    | null;
  return {
    id: String(bp.id),
    name: bp.name,
    description: bp.description ?? '',
    createdAt: new Date(bp.created_at).getTime(),
    updatedAt: new Date(bp.updated_at).getTime(),
    duration: 0,
    schemaVersion: tlWithVersion?.schemaVersion,
    metadata: {
      width: bp.width,
      height: bp.height,
      fps: bp.fps,
      backgroundColor: bp.background_color,
    },
    timeline: bp.timeline_data ?? undefined,
    thumbnail_url: bp.thumbnail_url ?? null,
  };
}

function frontendToBackendCreate(data: {
  name: string;
  description?: string;
  width?: number;
  height?: number;
  fps?: number;
  backgroundColor?: string;
  timeline_data?: ProjectTimeline;
}) {
  return {
    name: data.name,
    description: data.description ?? '',
    width: data.width ?? 1920,
    height: data.height ?? 1080,
    fps: data.fps ?? 30,
    background_color: data.backgroundColor ?? '#000000',
    timeline_data: data.timeline_data ?? null,
  };
}

function frontendToBackendUpdate(data: Partial<{
  name: string;
  description: string;
  metadata: ProjectResolution;
  timeline: ProjectTimeline;
}>) {
  const payload: Record<string, unknown> = {};

  if (data.name !== undefined) payload.name = data.name;
  if (data.description !== undefined) payload.description = data.description;
  if (data.metadata) {
    if (data.metadata.width !== undefined) payload.width = data.metadata.width;
    if (data.metadata.height !== undefined) payload.height = data.metadata.height;
    if (data.metadata.fps !== undefined) payload.fps = data.metadata.fps;
    if (data.metadata.backgroundColor !== undefined) payload.background_color = data.metadata.backgroundColor;
  }
  if (data.timeline !== undefined) payload.timeline_data = data.timeline;

  return payload;
}

// --- API Functions ---

export async function fetchProjects(): Promise<Project[]> {
  const data = await ApiClient.get<BackendProject[]>('/projects');
  return data.map(backendToFrontend);
}

export async function fetchProject(id: string): Promise<Project | null> {
  try {
    const data = await ApiClient.get<BackendProject>(`/projects/${id}`);
    return backendToFrontend(data);
  } catch {
    return null;
  }
}

export async function createProjectApi(data: {
  name: string;
  description?: string;
  width?: number;
  height?: number;
  fps?: number;
  backgroundColor?: string;
  timeline_data?: ProjectTimeline;
}): Promise<Project> {
  const payload = frontendToBackendCreate(data);
  const response = await ApiClient.post<BackendProject>('/projects', payload);
  return backendToFrontend(response);
}

export async function updateProjectApi(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    metadata: ProjectResolution;
    timeline: ProjectTimeline;
  }>
): Promise<Project> {
  const payload = frontendToBackendUpdate(data);
  const response = await ApiClient.put<BackendProject>(`/projects/${id}`, payload);
  return backendToFrontend(response);
}

export async function deleteProjectApi(id: string): Promise<void> {
  await ApiClient.delete(`/projects/${id}`);
}

// --- Server-side media inventory (for cross-device project loading) ---

export interface ServerMediaFile {
  id: number;
  client_media_id: string | null;
  name: string;
  type: 'video' | 'audio' | 'image';
  mime_type: string;
  path: string;
  url: string | null;
  size: number;
  duration: number | null;
  width: number | null;
  height: number | null;
  fps: number | string | null;
  hash: string | null;
  created_at: string;
}

export async function fetchProjectMedia(projectId: string): Promise<ServerMediaFile[]> {
  return ApiClient.get<ServerMediaFile[]>(`/projects/${projectId}/media`);
}

/**
 * Upload a local media file to the server so the project becomes portable
 * across devices. The client UUID is sent so the server-side row can be
 * looked up later by ID rather than by hash.
 */
export async function uploadProjectMedia(
  projectId: string,
  args: {
    file: File | Blob;
    fileName: string;
    type: 'video' | 'audio' | 'image';
    clientMediaId: string;
    duration?: number;
    width?: number;
    height?: number;
    fps?: number;
  }
): Promise<ServerMediaFile> {
  const form = new FormData();
  // FormData wants a File for the filename to round-trip; if we got a Blob
  // wrap it without losing the extension.
  const fileForUpload = args.file instanceof File
    ? args.file
    : new File([args.file], args.fileName);
  form.append('file', fileForUpload, args.fileName);
  form.append('type', args.type);
  form.append('client_media_id', args.clientMediaId);
  // Send the metadata we already extracted at import time so the server
  // doesn't have to re-probe with ffprobe — and so cross-device hydration
  // recreates the IndexedDB row with the correct duration / dimensions /
  // fps instead of a 0-frame placeholder.
  if (args.duration !== undefined && Number.isFinite(args.duration)) {
    form.append('duration', String(args.duration));
  }
  if (args.width !== undefined && Number.isFinite(args.width)) {
    form.append('width', String(args.width));
  }
  if (args.height !== undefined && Number.isFinite(args.height)) {
    form.append('height', String(args.height));
  }
  if (args.fps !== undefined && Number.isFinite(args.fps)) {
    form.append('fps', String(args.fps));
  }
  return ApiClient.upload<ServerMediaFile>(`/projects/${projectId}/media`, form);
}

/**
 * Store the project card preview server-side.
 *
 * The cover is rendered in the browser and kept in IndexedDB, so without this
 * the projects list falls back to a placeholder icon on any device that did
 * not create the project. The server keeps one image per project and replaces
 * it on each upload, so calling this on every save is safe.
 */
export async function uploadProjectThumbnail(
  projectId: string,
  blob: Blob,
): Promise<{ thumbnail_path: string; thumbnail_url: string | null }> {
  const form = new FormData();
  const extension = blob.type === 'image/png' ? 'png' : 'jpg';
  form.append('thumbnail', new File([blob], `cover.${extension}`, { type: blob.type }), `cover.${extension}`);
  return ApiClient.upload<{ thumbnail_path: string; thumbnail_url: string | null }>(
    `/projects/${projectId}/thumbnail`,
    form,
  );
}
