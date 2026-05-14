import { openDB, type IDBPDatabase } from 'idb';

/**
 * Stores client-only project fields that cannot be sent to the backend:
 * - rootFolderHandle (FileSystemDirectoryHandle - not serializable)
 * - rootFolderName (derived from handle)
 * - thumbnailId (references IndexedDB thumbnail store)
 * - schemaVersion (client migration tracking)
 */

const DB_NAME = 'freecut-project-local';
const DB_VERSION = 1;
const STORE_NAME = 'localData';

export interface ProjectLocalData {
  projectId: string;
  rootFolderHandle?: FileSystemDirectoryHandle;
  rootFolderName?: string;
  thumbnailId?: string;
  schemaVersion?: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getLocalDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'projectId' });
        }
      },
    });
  }
  return dbPromise;
}

export async function getProjectLocalData(
  projectId: string
): Promise<ProjectLocalData | undefined> {
  const db = await getLocalDB();
  return db.get(STORE_NAME, projectId);
}

export async function getAllProjectLocalData(): Promise<ProjectLocalData[]> {
  const db = await getLocalDB();
  return db.getAll(STORE_NAME);
}

export async function saveProjectLocalData(
  projectId: string,
  data: Partial<Omit<ProjectLocalData, 'projectId'>>
): Promise<void> {
  const db = await getLocalDB();
  const existing = await db.get(STORE_NAME, projectId);
  await db.put(STORE_NAME, {
    ...existing,
    ...data,
    projectId,
  });
}

export async function deleteProjectLocalData(
  projectId: string
): Promise<void> {
  const db = await getLocalDB();
  await db.delete(STORE_NAME, projectId);
}
