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
  timeline_data: ProjectTimeline | null;
  settings: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  media_files_count?: number;
}

// --- Mappers ---

function backendToFrontend(bp: BackendProject): Project {
  return {
    id: String(bp.id),
    name: bp.name,
    description: bp.description ?? '',
    createdAt: new Date(bp.created_at).getTime(),
    updatedAt: new Date(bp.updated_at).getTime(),
    duration: 0,
    metadata: {
      width: bp.width,
      height: bp.height,
      fps: bp.fps,
      backgroundColor: bp.background_color,
    },
    timeline: bp.timeline_data ?? undefined,
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
