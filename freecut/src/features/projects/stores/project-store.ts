import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { temporal } from 'zundo';
import type { Project } from '@/types/project';
import type { ProjectFormData } from '../utils/validation';
import { useSettingsStore } from '@/features/projects/deps/settings-contract';
import {
  getProjectMediaIds,
  associateMediaWithProject,
} from '@/infrastructure/storage/indexeddb';
import {
  fetchProjects,
  fetchProject,
  createProjectApi,
  updateProjectApi,
  deleteProjectApi,
} from '@/infrastructure/api/project-api';
import {
  getProjectLocalData,
  getAllProjectLocalData,
  saveProjectLocalData,
  deleteProjectLocalData,
} from '@/infrastructure/storage/indexeddb/project-local-data';
import { mediaLibraryService } from '@/features/projects/deps/media-library-contract';
import { createLogger } from '@/shared/logging/logger';

const logger = createLogger('ProjectStore');

interface ProjectState {
  // Data
  projects: Project[];
  currentProject: Project | null;

  // UI State
  isLoading: boolean;
  error: string | null;

  // Search and filter state
  searchQuery: string;
  sortField: 'name' | 'createdAt' | 'updatedAt' | 'resolution';
  sortDirection: 'asc' | 'desc';
  filterResolution?: string;
  filterFps?: number;
}

interface ProjectActions {
  // CRUD Operations
  loadProjects: () => Promise<void>;
  loadProject: (id: string) => Promise<Project | null>;
  createProject: (data: ProjectFormData) => Promise<Project>;
  updateProject: (id: string, data: Partial<ProjectFormData>) => Promise<Project>;
  deleteProject: (id: string, clearLocalFiles?: boolean) => Promise<{ localFilesDeleted: boolean }>;
  duplicateProject: (id: string) => Promise<Project>;

  // Project folder management
  setProjectRootFolder: (id: string, handle: FileSystemDirectoryHandle) => Promise<void>;
  clearProjectRootFolder: (id: string) => Promise<void>;

  // State management
  setCurrentProject: (project: Project | null) => void;
  setSearchQuery: (query: string) => void;
  setSortField: (field: ProjectState['sortField']) => void;
  setSortDirection: (direction: ProjectState['sortDirection']) => void;
  setFilterResolution: (resolution: string | undefined) => void;
  setFilterFps: (fps: number | undefined) => void;
  clearFilters: () => void;

  // Utility
  clearError: () => void;
}

/**
 * Merge backend project data with client-only local data (rootFolderHandle, thumbnailId, etc.)
 */
async function mergeWithLocalData(projects: Project[]): Promise<Project[]> {
  try {
    const allLocalData = await getAllProjectLocalData();
    const localDataMap = new Map(allLocalData.map((d) => [d.projectId, d]));

    return projects.map((p) => {
      const local = localDataMap.get(p.id);
      if (!local) return p;
      return {
        ...p,
        rootFolderHandle: local.rootFolderHandle,
        rootFolderName: local.rootFolderName,
        thumbnailId: local.thumbnailId,
        schemaVersion: local.schemaVersion,
      };
    });
  } catch {
    return projects;
  }
}

async function mergeOneWithLocalData(project: Project): Promise<Project> {
  try {
    const local = await getProjectLocalData(project.id);
    if (!local) return project;
    return {
      ...project,
      rootFolderHandle: local.rootFolderHandle,
      rootFolderName: local.rootFolderName,
      thumbnailId: local.thumbnailId,
      schemaVersion: local.schemaVersion,
    };
  } catch {
    return project;
  }
}

export const useProjectStore = create<ProjectState & ProjectActions>()(
  devtools(
    temporal(
      (set, get) => ({
        // Initial state
        projects: [],
        currentProject: null,
        isLoading: false,
        error: null,
        searchQuery: '',
        sortField: 'updatedAt',
        sortDirection: 'desc',
        filterResolution: undefined,
        filterFps: undefined,

        // Load all projects from backend API (user-scoped)
        loadProjects: async () => {
          set({ isLoading: true, error: null });

          try {
            const projects = await fetchProjects();
            const merged = await mergeWithLocalData(projects);
            set({ projects: merged, isLoading: false });
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Failed to load projects';
            set({ error: errorMessage, isLoading: false });
            throw error;
          }
        },

        // Load a single project by ID from backend
        loadProject: async (id: string) => {
          set({ isLoading: true, error: null });

          try {
            const project = await fetchProject(id);

            if (!project) {
              set({ error: `Project not found: ${id}`, isLoading: false });
              return null;
            }

            const merged = await mergeOneWithLocalData(project);
            set({ currentProject: merged, isLoading: false });
            return merged;
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Failed to load project';
            set({ error: errorMessage, isLoading: false });
            throw error;
          }
        },

        // Create a new project via backend API
        createProject: async (data: ProjectFormData) => {
          set({ isLoading: true, error: null });

          try {
            const newProject = await createProjectApi({
              name: data.name,
              description: data.description,
              width: data.width,
              height: data.height,
              fps: data.fps,
              backgroundColor: data.backgroundColor,
            });

            set((state) => ({
              projects: [...state.projects, newProject],
              currentProject: newProject,
              isLoading: false,
            }));

            return newProject;
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Failed to create project';
            set({ error: errorMessage, isLoading: false });
            throw error;
          }
        },

        // Update an existing project via backend API
        updateProject: async (id: string, data: Partial<ProjectFormData>) => {
          set({ isLoading: true, error: null });

          const previousProjects = get().projects;
          const currentProject = get().currentProject;
          const projectIndex = previousProjects.findIndex((p) => p.id === id);

          let existingProject: Project | null = null;
          if (projectIndex !== -1) {
            existingProject = previousProjects[projectIndex] ?? null;
          } else if (currentProject?.id === id) {
            existingProject = currentProject;
          }

          if (!existingProject) {
            set({ error: `Project not found: ${id}`, isLoading: false });
            throw new Error(`Project not found: ${id}`);
          }

          const updatedProject: Project = {
            ...existingProject,
            name: data.name ?? existingProject.name,
            description: data.description ?? existingProject.description,
            metadata: {
              width: data.width ?? existingProject.metadata.width,
              height: data.height ?? existingProject.metadata.height,
              fps: data.fps ?? existingProject.metadata.fps,
              backgroundColor: data.backgroundColor ?? existingProject.metadata.backgroundColor,
            },
            updatedAt: Date.now(),
          };

          // Optimistic update
          if (projectIndex !== -1) {
            const optimisticProjects = [...previousProjects];
            optimisticProjects[projectIndex] = updatedProject;
            set({ projects: optimisticProjects });
          }
          if (currentProject?.id === id) {
            set({ currentProject: updatedProject });
          }

          try {
            const updated = await updateProjectApi(id, {
              name: data.name,
              description: data.description,
              metadata: {
                width: data.width ?? existingProject.metadata.width,
                height: data.height ?? existingProject.metadata.height,
                fps: data.fps ?? existingProject.metadata.fps,
                backgroundColor: data.backgroundColor ?? existingProject.metadata.backgroundColor,
              },
            });

            const merged = await mergeOneWithLocalData(updated);

            if (get().currentProject?.id === id) {
              set({ currentProject: merged });
            }

            set({ isLoading: false });
            return merged;
          } catch (error) {
            // Rollback on error
            if (projectIndex !== -1) {
              set({ projects: previousProjects });
            }
            if (currentProject?.id === id) {
              set({ currentProject: currentProject });
            }

            const errorMessage =
              error instanceof Error ? error.message : 'Failed to update project';
            set({ error: errorMessage, isLoading: false });
            throw error;
          }
        },

        // Delete a project via backend API
        deleteProject: async (id: string, clearLocalFiles?: boolean) => {
          set({ isLoading: true, error: null });

          const previousProjects = get().projects;
          const projectToDelete = previousProjects.find((p) => p.id === id);
          let localFilesDeleted = false;
          let partialLocalDeletion = false;

          // If user wants to clear local files, check/request permission FIRST
          let fsPermissionGranted = false;
          const handle = clearLocalFiles ? projectToDelete?.rootFolderHandle : undefined;
          if (handle) {
            let permission = await handle.queryPermission({ mode: 'readwrite' });
            if (permission !== 'granted') {
              permission = await handle.requestPermission({ mode: 'readwrite' });
            }
            fsPermissionGranted = permission === 'granted';
            if (!fsPermissionGranted) {
              logger.warn(`Permission denied to clear local files for project ${id}`);
              set({ isLoading: false });
              throw new Error('Filesystem permission denied — project was not deleted. Please grant access and try again.');
            }
          }

          // Optimistic update
          const optimisticProjects = previousProjects.filter((p) => p.id !== id);
          set({ projects: optimisticProjects });

          const previousCurrentProject = get().currentProject;
          if (previousCurrentProject?.id === id) {
            set({ currentProject: null });
          }

          try {
            // Delete local files first
            if (handle && fsPermissionGranted) {
              try {
                const handleWithRemove = handle as FileSystemDirectoryHandle & {
                  remove?: (options?: { recursive?: boolean }) => Promise<void>;
                };
                if (typeof handleWithRemove.remove === 'function') {
                  await handleWithRemove.remove({ recursive: true });
                  localFilesDeleted = true;
                } else {
                  let allRemoved = true;
                  let anyRemoved = false;
                  for await (const entry of handle.values()) {
                    try {
                      await handle.removeEntry(entry.name, { recursive: true });
                      anyRemoved = true;
                    } catch (entryError) {
                      allRemoved = false;
                      logger.error(`Failed to remove entry "${entry.name}" in project ${id}:`, entryError);
                    }
                  }
                  localFilesDeleted = allRemoved;
                  if (anyRemoved && !allRemoved) {
                    partialLocalDeletion = true;
                  }
                }
              } catch (fsError) {
                logger.error(`Failed to clear local files for project ${id}:`, fsError);
              }
            }

            // Delete media associations from IndexedDB
            await mediaLibraryService.deleteAllMediaFromProject(id);

            // Delete from backend
            await deleteProjectApi(id);

            // Delete local data
            await deleteProjectLocalData(id);

            set({ isLoading: false });
            return { localFilesDeleted };
          } catch (error) {
            if (localFilesDeleted || partialLocalDeletion) {
              const scope = localFilesDeleted ? 'All local files deleted' : 'Some local files deleted';
              const errorMessage = `${scope} but database cleanup failed — project may be inconsistent`;
              logger.error(errorMessage, error);
              set({ error: errorMessage, isLoading: false });
              throw new Error(errorMessage, { cause: error });
            }
            // Rollback on error
            set({ projects: previousProjects, currentProject: previousCurrentProject });

            const errorMessage =
              error instanceof Error ? error.message : 'Failed to delete project';
            set({ error: errorMessage, isLoading: false });
            throw error;
          }
        },

        // Duplicate an existing project via backend API
        duplicateProject: async (id: string) => {
          set({ isLoading: true, error: null });

          const originalProject = get().projects.find((p) => p.id === id);

          if (!originalProject) {
            set({ error: `Project not found: ${id}`, isLoading: false });
            throw new Error(`Project not found: ${id}`);
          }

          try {
            const newProject = await createProjectApi({
              name: `${originalProject.name} (Copy)`,
              description: originalProject.description,
              width: originalProject.metadata.width,
              height: originalProject.metadata.height,
              fps: originalProject.metadata.fps,
              backgroundColor: originalProject.metadata.backgroundColor,
              timeline_data: originalProject.timeline,
            });

            set((state) => ({
              projects: [...state.projects, newProject],
              isLoading: false,
            }));

            // Copy media associations from original to new project
            const mediaIds = await getProjectMediaIds(id);
            for (const mediaId of mediaIds) {
              await associateMediaWithProject(newProject.id, mediaId);
            }

            return newProject;
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Failed to duplicate project';
            set({ error: errorMessage, isLoading: false });
            throw error;
          }
        },

        // Project folder management (client-only — uses local IndexedDB)
        setProjectRootFolder: async (id: string, handle: FileSystemDirectoryHandle) => {
          const previousProjects = get().projects;
          const currentProject = get().currentProject;

          const folderName = handle.name;
          const updateProjectInList = (project: Project) => ({
            ...project,
            rootFolderHandle: handle,
            rootFolderName: folderName,
            updatedAt: Date.now(),
          });

          if (currentProject?.id === id) {
            set({ currentProject: updateProjectInList(currentProject) });
          }

          const projectIndex = previousProjects.findIndex((p) => p.id === id);
          if (projectIndex !== -1) {
            const optimisticProjects = [...previousProjects];
            optimisticProjects[projectIndex] = updateProjectInList(previousProjects[projectIndex]!);
            set({ projects: optimisticProjects });
          }

          try {
            await saveProjectLocalData(id, {
              rootFolderHandle: handle,
              rootFolderName: folderName,
            });
          } catch (error) {
            set({ projects: previousProjects, currentProject });
            throw error;
          }
        },

        clearProjectRootFolder: async (id: string) => {
          const previousProjects = get().projects;
          const currentProject = get().currentProject;

          const updateProjectInList = (project: Project) => ({
            ...project,
            rootFolderHandle: undefined,
            rootFolderName: undefined,
            updatedAt: Date.now(),
          });

          if (currentProject?.id === id) {
            set({ currentProject: updateProjectInList(currentProject) });
          }

          const projectIndex = previousProjects.findIndex((p) => p.id === id);
          if (projectIndex !== -1) {
            const optimisticProjects = [...previousProjects];
            optimisticProjects[projectIndex] = updateProjectInList(previousProjects[projectIndex]!);
            set({ projects: optimisticProjects });
          }

          try {
            await saveProjectLocalData(id, {
              rootFolderHandle: undefined,
              rootFolderName: undefined,
            });
          } catch (error) {
            set({ projects: previousProjects, currentProject });
            throw error;
          }
        },

        // State setters
        setCurrentProject: (project) => set({ currentProject: project }),
        setSearchQuery: (query) => set({ searchQuery: query }),
        setSortField: (field) => set({ sortField: field }),
        setSortDirection: (direction) => set({ sortDirection: direction }),
        setFilterResolution: (resolution) => set({ filterResolution: resolution }),
        setFilterFps: (fps) => set({ filterFps: fps }),
        clearFilters: () =>
          set({
            searchQuery: '',
            filterResolution: undefined,
            filterFps: undefined,
          }),
        clearError: () => set({ error: null }),
      }),
      {
        // Zundo options — no static limit; trimmed dynamically via subscription below
        partialize: (state) => {
          return {
            projects: state.projects,
            currentProject: state.currentProject,
          };
        },
      }
    ),
    {
      // Devtools options
      name: 'ProjectStore',
      enabled: import.meta.env.DEV,
    }
  )
);

// Enforce undo history cap on every save (zundo's static `limit` was removed).
useProjectStore.temporal.getState().setOnSave(() => {
  const max = useSettingsStore.getState().maxUndoHistory;
  const { pastStates, futureStates } = useProjectStore.temporal.getState();
  if (pastStates.length > max || futureStates.length > max) {
    useProjectStore.temporal.setState({
      pastStates: pastStates.slice(-max),
      futureStates: futureStates.slice(-max),
    });
  }
});

// When maxUndoHistory changes, immediately trim both stacks.
useSettingsStore.subscribe((state, prevState) => {
  if (state.maxUndoHistory !== prevState.maxUndoHistory) {
    const { pastStates, futureStates } = useProjectStore.temporal.getState();
    if (pastStates.length > state.maxUndoHistory || futureStates.length > state.maxUndoHistory) {
      useProjectStore.temporal.setState({
        pastStates: pastStates.slice(-state.maxUndoHistory),
        futureStates: futureStates.slice(-state.maxUndoHistory),
      });
    }
  }
});
